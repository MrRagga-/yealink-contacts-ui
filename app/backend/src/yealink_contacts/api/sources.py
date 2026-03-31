from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from yealink_contacts.adapters.base import AddressbookInfo
from yealink_contacts.api.deps import db_session, get_source_or_404
from yealink_contacts.core.config import get_settings
from yealink_contacts.schemas.source import (
    SourceAddressbookBase,
    SourceCreate,
    SourceResponse,
    SourceTestResponse,
    SourceUpdate,
)
from yealink_contacts.services.source_service import (
    build_adapter,
    complete_google_oauth,
    create_source,
    delete_source,
    get_credential_payload,
    list_sources,
    resolve_google_redirect_uri,
    start_google_oauth,
    summarize_source,
    update_source,
)
from yealink_contacts.services.sync_service import run_sync

router = APIRouter(prefix="/sources", tags=["sources"])


def _source_conflict_detail(exc: IntegrityError) -> str:
    message = str(exc.orig).lower()
    if "sources.slug" in message or "sources_slug_key" in message:
        return "A source with this slug already exists."
    if "sources.name" in message or "sources_name_key" in message:
        return "A source with this name already exists."
    return "A source with this name or slug already exists."


def _serialize_addressbooks(books: list[AddressbookInfo]) -> list[SourceAddressbookBase]:
    return [SourceAddressbookBase.model_validate(book.model_dump()) for book in books]


def _build_google_callback_url(source, request: Request) -> str:
    redirect_uri = resolve_google_redirect_uri(get_credential_payload(source))
    parsed_redirect_uri = urlsplit(redirect_uri)
    combined_query = parse_qsl(parsed_redirect_uri.query, keep_blank_values=True) + list(
        request.query_params.multi_items()
    )
    return urlunsplit(
        (
            parsed_redirect_uri.scheme,
            parsed_redirect_uri.netloc,
            parsed_redirect_uri.path,
            urlencode(combined_query, doseq=True),
            "",
        )
    )


@router.get("", response_model=list[SourceResponse])
def sources(db: Session = Depends(db_session)) -> list[SourceResponse]:
    return [summarize_source(item) for item in list_sources(db)]


@router.post("", response_model=SourceResponse)
def create(payload: SourceCreate, db: Session = Depends(db_session)) -> SourceResponse:
    try:
        source = create_source(db, payload)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=_source_conflict_detail(exc)) from exc
    return summarize_source(source)


@router.patch("/{source_id}", response_model=SourceResponse)
def update(
    payload: SourceUpdate,
    source=Depends(get_source_or_404),
    db: Session = Depends(db_session),
) -> SourceResponse:
    try:
        updated = update_source(db, source, payload)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=_source_conflict_detail(exc)) from exc
    return summarize_source(updated)


@router.delete("/{source_id}")
def remove(source=Depends(get_source_or_404), db: Session = Depends(db_session)) -> dict[str, str]:
    delete_source(db, source)
    return {"message": "Source deleted."}


@router.post("/{source_id}/test", response_model=SourceTestResponse)
def test_source(source=Depends(get_source_or_404)) -> SourceTestResponse:
    try:
        adapter = build_adapter(source)
        ok, message = adapter.test_connection()
        books = _serialize_addressbooks(adapter.list_addressbooks()) if ok else []
        return SourceTestResponse(
            ok=ok,
            message=message,
            capabilities=adapter.get_capabilities(),
            addressbooks=books,
        )
    except Exception as exc:
        return SourceTestResponse(ok=False, message=str(exc), capabilities={}, addressbooks=[])


@router.post("/{source_id}/discover-addressbooks", response_model=SourceTestResponse)
def discover_addressbooks(source=Depends(get_source_or_404)) -> SourceTestResponse:
    adapter = build_adapter(source)
    books = _serialize_addressbooks(adapter.list_addressbooks())
    return SourceTestResponse(
        ok=True,
        message=f"Discovered {len(books)} addressbook(s).",
        capabilities=adapter.get_capabilities(),
        addressbooks=books,
    )


@router.post("/{source_id}/sync")
def sync_source(source=Depends(get_source_or_404), db: Session = Depends(db_session)):
    return run_sync(db, source)


@router.post("/{source_id}/oauth/google/start")
def google_oauth_start(source=Depends(get_source_or_404), db: Session = Depends(db_session)):
    if source.type.value != "google":
        raise HTTPException(status_code=400, detail="OAuth is only available for Google sources.")
    return start_google_oauth(db, source)


@router.get("/oauth/google/callback")
def google_oauth_callback(
    request: Request,
    state: str,
    db: Session = Depends(db_session),
):
    source = get_source_or_404(state, db)
    complete_google_oauth(db, source, _build_google_callback_url(source, request))
    frontend_origin = get_settings().frontend_origin.rstrip("/")
    return RedirectResponse(url=f"{frontend_origin}/sources?google=connected&sourceId={source.id}")

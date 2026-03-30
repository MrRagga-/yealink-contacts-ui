from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from yealink_contacts.api.deps import db_session
from yealink_contacts.services.export_service import build_phonebook_xml

router = APIRouter(prefix="/yealink", tags=["yealink"])


@router.get("/phonebook/{profile_slug}.xml")
def phonebook(profile_slug: str, request: Request, db: Session = Depends(db_session)) -> Response:
    try:
        phonebook = build_phonebook_xml(db, profile_slug)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    headers = {
        "ETag": phonebook.etag,
        "Cache-Control": "private, no-cache",
        "X-Cache": "HIT" if phonebook.cache_hit else "MISS",
    }
    if request.headers.get("if-none-match") == phonebook.etag:
        return Response(status_code=304, headers=headers)
    return Response(content=phonebook.xml_body, media_type=phonebook.content_type, headers=headers)

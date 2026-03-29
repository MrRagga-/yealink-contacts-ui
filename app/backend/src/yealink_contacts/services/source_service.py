from __future__ import annotations

import os
import json
from contextlib import contextmanager

from google_auth_oauthlib.flow import Flow
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from yealink_contacts.adapters.base import SourceAdapter
from yealink_contacts.adapters.sources.carddav import CardDAVAdapter, CardDAVConfig
from yealink_contacts.adapters.sources.google import GoogleAdapterConfig, GoogleContactsAdapter
from yealink_contacts.core.security import cipher
from yealink_contacts.models.source import Source, SourceAddressbook, SourceCredential, SourceType
from yealink_contacts.schemas.source import (
    GoogleAuthStartResponse,
    SourceAddressbookBase,
    SourceCreate,
    SourceCredentialPayload,
    SourceResponse,
    SourceUpdate,
)
from yealink_contacts.services.audit import write_audit_log
from yealink_contacts.services.utils import slugify


def list_sources(db: Session) -> list[Source]:
    return list(
        db.execute(
            select(Source).options(joinedload(Source.addressbooks), joinedload(Source.credential)).order_by(Source.name)
        )
        .unique()
        .scalars()
        .all()
    )


def get_source(db: Session, source_id: str) -> Source | None:
    return (
        db.execute(
            select(Source)
            .where(Source.id == source_id)
            .options(joinedload(Source.addressbooks), joinedload(Source.credential))
        )
        .unique()
        .scalar_one_or_none()
    )


def create_source(db: Session, payload: SourceCreate) -> Source:
    source = Source(
        name=payload.name,
        slug=payload.slug or slugify(payload.name),
        type=payload.type,
        is_active=payload.is_active,
        notes=payload.notes,
        tags=payload.tags,
    )
    db.add(source)
    db.flush()
    _save_credential(source, payload.credential)
    _replace_addressbooks(source, payload.addressbooks)
    write_audit_log(db, "source", source.id, "created", payload.model_dump(exclude={"credential"}))
    db.commit()
    db.refresh(source)
    return get_source(db, source.id) or source


def update_source(db: Session, source: Source, payload: SourceUpdate) -> Source:
    if payload.name is not None:
        source.name = payload.name
    if payload.slug is not None:
        source.slug = payload.slug or slugify(source.name)
    if payload.is_active is not None:
        source.is_active = payload.is_active
    if payload.notes is not None:
        source.notes = payload.notes
    if payload.tags is not None:
        source.tags = payload.tags
    if payload.credential is not None:
        current = get_credential_payload(source)
        merged = current.model_copy(
            update={key: value for key, value in payload.credential.model_dump().items() if value not in (None, "")}
        )
        _save_credential(source, merged)
    if payload.addressbooks is not None:
        _replace_addressbooks(source, payload.addressbooks)
    write_audit_log(db, "source", source.id, "updated", payload.model_dump(exclude_none=True, exclude={"credential"}))
    db.commit()
    db.refresh(source)
    return get_source(db, source.id) or source


def delete_source(db: Session, source: Source) -> None:
    write_audit_log(db, "source", source.id, "deleted", {"name": source.name})
    db.delete(source)
    db.commit()


def get_credential_payload(source: Source) -> SourceCredentialPayload:
    if not source.credential:
        return SourceCredentialPayload()
    decrypted = cipher.decrypt(source.credential.encrypted_payload)
    return SourceCredentialPayload.model_validate(json.loads(decrypted))


def summarize_source(source: Source) -> SourceResponse:
    credential = get_credential_payload(source)
    summary: dict[str, str | bool] = {}
    summary["merge_strategy"] = credential.merge_strategy.value
    if credential.server_url:
        summary["server_url"] = credential.server_url
    if credential.username:
        summary["username"] = credential.username
    if credential.account_email:
        summary["account_email"] = credential.account_email
    if credential.google_client_id:
        summary["google_client_id"] = credential.google_client_id
    if credential.google_redirect_uri:
        summary["google_redirect_uri"] = credential.google_redirect_uri
    if credential.google_auth_uri:
        summary["google_auth_uri"] = credential.google_auth_uri
    if credential.token_uri:
        summary["token_uri"] = credential.token_uri
    if credential.google_client_secret:
        summary["google_client_secret_configured"] = True
    if credential.refresh_token:
        summary["google_refresh_token_configured"] = True
    return SourceResponse.model_validate(
        {
            **source.__dict__,
            "addressbooks": source.addressbooks,
            "credential_summary": summary,
        }
    )


def build_adapter(source: Source) -> SourceAdapter:
    credential = get_credential_payload(source)
    if source.type in {SourceType.carddav, SourceType.nextcloud_carddav}:
        if not credential.server_url or not credential.username or not credential.password:
            raise ValueError("CardDAV credentials are incomplete.")
        selected = [item.href for item in source.addressbooks if item.is_selected]
        return CardDAVAdapter(
            CardDAVConfig(
                server_url=credential.server_url,
                username=credential.username,
                password=credential.password,
                selected_addressbooks=selected,
            )
        )

    if source.type == SourceType.google:
        if not credential.google_client_id or not credential.google_client_secret:
            raise ValueError("Google client ID and client secret must be configured on the source.")
        if not credential.refresh_token:
            raise ValueError("Google source is not connected yet. Complete OAuth first.")
        return GoogleContactsAdapter(
            GoogleAdapterConfig(
                client_id=credential.google_client_id,
                client_secret=credential.google_client_secret,
                refresh_token=credential.refresh_token,
                redirect_uri=credential.google_redirect_uri,
                auth_uri=credential.google_auth_uri,
                token_uri=credential.token_uri,
                access_token=credential.access_token,
                account_email=credential.account_email,
            )
        )
    raise ValueError(f"Unsupported source type: {source.type}")


def start_google_oauth(db: Session, source: Source) -> GoogleAuthStartResponse:
    credential = get_credential_payload(source)
    if not credential.google_client_id or not credential.google_client_secret:
        raise ValueError("Google client ID and client secret are missing on this source.")
    redirect_uri = credential.google_redirect_uri or "http://localhost:8000/api/sources/oauth/google/callback"
    auth_uri = credential.google_auth_uri or "https://accounts.google.com/o/oauth2/auth"
    token_uri = credential.token_uri or "https://oauth2.googleapis.com/token"
    with _oauth_transport_context(redirect_uri):
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": credential.google_client_id,
                    "client_secret": credential.google_client_secret,
                    "auth_uri": auth_uri,
                    "token_uri": token_uri,
                    "redirect_uris": [redirect_uri],
                }
            },
            scopes=["https://www.googleapis.com/auth/contacts.readonly", "openid", "email"],
            redirect_uri=redirect_uri,
        )
        authorization_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
            state=source.id,
        )
        credential.google_code_verifier = flow.code_verifier
        _save_credential(source, credential)
        db.commit()
    return GoogleAuthStartResponse(authorization_url=authorization_url)


def complete_google_oauth(db: Session, source: Source, callback_url: str) -> Source:
    payload = get_credential_payload(source)
    if not payload.google_client_id or not payload.google_client_secret:
        raise ValueError("Google client ID and client secret are missing on this source.")
    redirect_uri = payload.google_redirect_uri or "http://localhost:8000/api/sources/oauth/google/callback"
    auth_uri = payload.google_auth_uri or "https://accounts.google.com/o/oauth2/auth"
    token_uri = payload.token_uri or "https://oauth2.googleapis.com/token"
    with _oauth_transport_context(redirect_uri):
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": payload.google_client_id,
                    "client_secret": payload.google_client_secret,
                    "auth_uri": auth_uri,
                    "token_uri": token_uri,
                    "redirect_uris": [redirect_uri],
                }
            },
            scopes=["https://www.googleapis.com/auth/contacts.readonly", "openid", "email"],
            redirect_uri=redirect_uri,
        )
        if payload.google_code_verifier:
            flow.code_verifier = payload.google_code_verifier
        flow.fetch_token(authorization_response=callback_url)
        credentials = flow.credentials
    payload.refresh_token = credentials.refresh_token or payload.refresh_token
    payload.access_token = credentials.token
    payload.token_uri = credentials.token_uri or token_uri
    payload.google_code_verifier = None
    _save_credential(source, payload)
    write_audit_log(db, "source", source.id, "google_oauth_completed", {})
    db.commit()
    db.refresh(source)
    return source


def _save_credential(source: Source, payload: SourceCredentialPayload) -> None:
    serialized = json.dumps(payload.model_dump(), ensure_ascii=False)
    encrypted = cipher.encrypt(serialized)
    if source.credential:
        source.credential.encrypted_payload = encrypted
    else:
        source.credential = SourceCredential(encrypted_payload=encrypted)


def _replace_addressbooks(source: Source, payload: list[SourceAddressbookBase]) -> None:
    source.addressbooks.clear()
    for addressbook in payload:
        source.addressbooks.append(
            SourceAddressbook(
                remote_id=addressbook.remote_id,
                href=addressbook.href,
                display_name=addressbook.display_name,
                description=addressbook.description,
                is_selected=addressbook.is_selected,
                sync_token=addressbook.sync_token,
            )
        )


@contextmanager
def _oauth_transport_context(redirect_uri: str):
    allow_insecure = redirect_uri.startswith("http://")
    previous_value = os.environ.get("OAUTHLIB_INSECURE_TRANSPORT")
    previous_relax_scope = os.environ.get("OAUTHLIB_RELAX_TOKEN_SCOPE")
    if allow_insecure:
        os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
    os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"
    try:
        yield
    finally:
        if allow_insecure:
            if previous_value is None:
                os.environ.pop("OAUTHLIB_INSECURE_TRANSPORT", None)
            else:
                os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = previous_value
        if previous_relax_scope is None:
            os.environ.pop("OAUTHLIB_RELAX_TOKEN_SCOPE", None)
        else:
            os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = previous_relax_scope

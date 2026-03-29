from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from yealink_contacts.api.deps import db_session
from yealink_contacts.services.export_service import build_phonebook_xml

router = APIRouter(prefix="/yealink", tags=["yealink"])


@router.get("/phonebook/{profile_slug}.xml")
def phonebook(profile_slug: str, db: Session = Depends(db_session)) -> Response:
    try:
        xml_body, content_type = build_phonebook_xml(db, profile_slug)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(content=xml_body, media_type=content_type)

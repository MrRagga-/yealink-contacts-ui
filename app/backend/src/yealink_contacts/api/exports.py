from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from yealink_contacts.api.deps import db_session
from yealink_contacts.schemas.contact import ExportPreviewResponse
from yealink_contacts.services.export_service import get_export_profile, generate_preview, list_export_profiles

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/preview", response_model=ExportPreviewResponse)
def preview(profile_id: str | None = Query(default=None), db: Session = Depends(db_session)) -> ExportPreviewResponse:
    profile = get_export_profile(db, profile_id) if profile_id else None
    if profile is None:
        profiles = list_export_profiles(db)
        if not profiles:
            raise HTTPException(status_code=404, detail="No export profile found.")
        profile = profiles[0]
    return generate_preview(db, profile)

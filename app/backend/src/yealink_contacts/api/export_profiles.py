from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from yealink_contacts.api.deps import db_session, get_profile_or_404
from yealink_contacts.schemas.contact import ExportPreviewResponse
from yealink_contacts.schemas.export_profile import (
    ExportProfileCreate,
    ExportProfileResponse,
    ExportProfileUpdate,
)
from yealink_contacts.services.export_service import (
    create_export_profile,
    generate_preview,
    list_export_profiles,
    serialize_export_profile,
    update_export_profile,
)

router = APIRouter(prefix="/export-profiles", tags=["export_profiles"])


@router.get("", response_model=list[ExportProfileResponse])
def profiles(db: Session = Depends(db_session)) -> list[ExportProfileResponse]:
    return [serialize_export_profile(profile) for profile in list_export_profiles(db)]


@router.post("", response_model=ExportProfileResponse)
def create_profile(payload: ExportProfileCreate, db: Session = Depends(db_session)) -> ExportProfileResponse:
    profile = create_export_profile(db, payload)
    return serialize_export_profile(profile)


@router.patch("/{profile_id}", response_model=ExportProfileResponse)
def update_profile(
    payload: ExportProfileUpdate,
    profile=Depends(get_profile_or_404),
    db: Session = Depends(db_session),
) -> ExportProfileResponse:
    updated = update_export_profile(db, profile, payload)
    return serialize_export_profile(updated)


@router.post("/{profile_id}/preview", response_model=ExportPreviewResponse)
def preview(
    profile=Depends(get_profile_or_404),
    preview_limit: int | None = None,
    include_xml: bool = True,
    db: Session = Depends(db_session),
) -> ExportPreviewResponse:
    return generate_preview(db, profile, preview_limit=preview_limit, include_xml=include_xml)

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from yealink_contacts.api.deps import db_session
from yealink_contacts.schemas.settings import AppSettingsResponse, AppSettingsUpdate
from yealink_contacts.services.settings_service import get_app_settings, update_app_settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=AppSettingsResponse)
def settings(db: Session = Depends(db_session)) -> AppSettingsResponse:
    return get_app_settings(db)


@router.patch("", response_model=AppSettingsResponse)
def update_settings(payload: AppSettingsUpdate, db: Session = Depends(db_session)) -> AppSettingsResponse:
    return update_app_settings(db, payload)

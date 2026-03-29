from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from yealink_contacts.api.deps import db_session
from yealink_contacts.schemas.config import AppConfigExport
from yealink_contacts.services.config_service import export_configuration, import_configuration

router = APIRouter(prefix="/config", tags=["config"])


@router.post("/export", response_model=AppConfigExport)
def export_config(db: Session = Depends(db_session)) -> AppConfigExport:
    return export_configuration(db)


@router.post("/import", response_model=AppConfigExport)
def import_config(payload: AppConfigExport, db: Session = Depends(db_session)) -> AppConfigExport:
    return import_configuration(db, payload)

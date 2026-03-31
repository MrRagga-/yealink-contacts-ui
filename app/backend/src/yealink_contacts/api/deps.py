from __future__ import annotations

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from yealink_contacts.db.session import get_db
from yealink_contacts.models.auth import AdminUser
from yealink_contacts.models.export_profile import ExportProfile
from yealink_contacts.models.source import Source
from yealink_contacts.services.auth_service import get_current_admin_user_from_session
from yealink_contacts.services.export_service import get_export_profile
from yealink_contacts.services.source_service import get_source


def db_session(db: Session = Depends(get_db)) -> Session:
    return db


def get_source_or_404(source_id: str, db: Session = Depends(db_session)) -> Source:
    source = get_source(db, source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found.")
    return source


def get_profile_or_404(profile_id: str, db: Session = Depends(db_session)) -> ExportProfile:
    profile = get_export_profile(db, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Export profile not found.")
    return profile


def current_admin_user(request: Request, db: Session = Depends(db_session)) -> AdminUser:
    return get_current_admin_user_from_session(request, db)

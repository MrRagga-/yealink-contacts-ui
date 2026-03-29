from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from yealink_contacts.api.deps import db_session
from yealink_contacts.schemas.dashboard import DashboardResponse
from yealink_contacts.services.dashboard_service import get_dashboard

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(db: Session = Depends(db_session)) -> DashboardResponse:
    return get_dashboard(db)

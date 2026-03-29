from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from yealink_contacts.api.deps import db_session
from yealink_contacts.services.log_service import list_audit_logs, list_job_events

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("")
def logs(db: Session = Depends(db_session)) -> dict:
    return {
        "audit_logs": [
            {
                "id": item.id,
                "entity_type": item.entity_type,
                "entity_id": item.entity_id,
                "action": item.action,
                "payload": item.payload,
                "created_at": item.created_at,
            }
            for item in list_audit_logs(db)
        ],
        "job_events": [
            {
                "id": item.id,
                "sync_job_id": item.sync_job_id,
                "level": item.level,
                "message": item.message,
                "details": item.details,
                "created_at": item.created_at,
            }
            for item in list_job_events(db)
        ],
    }

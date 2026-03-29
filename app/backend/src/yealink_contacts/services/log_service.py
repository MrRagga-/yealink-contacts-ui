from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from yealink_contacts.models.audit import AuditLog
from yealink_contacts.models.job import SyncJobEvent


def list_audit_logs(db: Session, limit: int = 100) -> list[AuditLog]:
    return db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).scalars().all()


def list_job_events(db: Session, limit: int = 100) -> list[SyncJobEvent]:
    return db.execute(select(SyncJobEvent).order_by(SyncJobEvent.created_at.desc()).limit(limit)).scalars().all()

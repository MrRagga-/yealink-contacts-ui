from __future__ import annotations

from sqlalchemy.orm import Session

from yealink_contacts.models.audit import AuditLog


def write_audit_log(db: Session, entity_type: str, entity_id: str, action: str, payload: dict) -> None:
    db.add(
        AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            payload=payload,
        )
    )

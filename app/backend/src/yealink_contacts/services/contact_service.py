from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from yealink_contacts.dedup.service import DuplicateDetector
from yealink_contacts.models.contact import Contact
from yealink_contacts.services.audit import write_audit_log
from yealink_contacts.services.export_service import invalidate_phonebook_cache


def _apply_contact_filters(statement, query: str | None = None, source_id: str | None = None):
    if source_id:
        statement = statement.where(Contact.source_id == source_id)
    if query:
        like_query = f"%{query.lower()}%"
        statement = statement.where(
            or_(
                Contact.full_name.ilike(like_query),
                Contact.organization.ilike(like_query),
                Contact.notes.ilike(like_query),
            )
        )
    return statement


def list_contacts(
    db: Session,
    query: str | None = None,
    source_id: str | None = None,
    *,
    offset: int = 0,
    limit: int = 25,
) -> tuple[list[Contact], int]:
    count_statement = _apply_contact_filters(select(func.count()).select_from(Contact), query, source_id)
    total = db.scalar(count_statement) or 0

    statement = _apply_contact_filters(
        select(Contact).options(
        joinedload(Contact.source),
        joinedload(Contact.phone_numbers),
        joinedload(Contact.emails),
        joinedload(Contact.addresses),
        ),
        query,
        source_id,
    )
    items = list(
        db.execute(statement.order_by(Contact.full_name).offset(offset).limit(limit)).unique().scalars().all()
    )
    return items, total


def get_contact(db: Session, contact_id: str) -> Contact | None:
    return (
        db.execute(
            select(Contact)
            .where(Contact.id == contact_id)
            .options(
                joinedload(Contact.source),
                joinedload(Contact.phone_numbers),
                joinedload(Contact.emails),
                joinedload(Contact.addresses),
            )
        )
        .unique()
        .scalar_one_or_none()
    )


def delete_contact(db: Session, contact: Contact) -> None:
    write_audit_log(
        db,
        "contact",
        contact.id,
        "deleted",
        {
            "full_name": contact.full_name,
            "source_id": contact.source_id,
            "source_contact_id": contact.source_contact_id,
        },
    )
    db.delete(contact)
    db.commit()
    invalidate_phonebook_cache()


def build_duplicate_hints(contacts: list[Contact]) -> dict[str, list]:
    return DuplicateDetector().build_hints(contacts)

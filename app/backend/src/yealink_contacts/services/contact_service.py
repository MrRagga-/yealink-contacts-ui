from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from yealink_contacts.dedup.service import DuplicateDetector
from yealink_contacts.models.contact import Contact
from yealink_contacts.services.audit import write_audit_log


def list_contacts(db: Session, query: str | None = None, source_id: str | None = None) -> list[Contact]:
    statement = select(Contact).options(
        joinedload(Contact.source),
        joinedload(Contact.phone_numbers),
        joinedload(Contact.emails),
        joinedload(Contact.addresses),
    )
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
    return db.execute(statement.order_by(Contact.full_name)).unique().scalars().all()


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


def build_duplicate_hints(contacts: list[Contact]) -> dict[str, list]:
    return DuplicateDetector().build_hints(contacts)

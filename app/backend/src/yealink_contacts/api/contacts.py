from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from yealink_contacts.api.deps import db_session
from yealink_contacts.schemas.common import MessageResponse
from yealink_contacts.schemas.contact import ContactListItemResponse, ContactListResponse, ContactResponse
from yealink_contacts.services.contact_service import (
    build_duplicate_hints,
    delete_contact,
    get_contact,
    list_contacts,
)

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=ContactListResponse)
def contacts(
    q: str | None = Query(default=None),
    source_id: str | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(db_session),
) -> ContactListResponse:
    items, total = list_contacts(db, q, source_id, offset=offset, limit=limit)
    hints = build_duplicate_hints(items)
    serialized = []
    for item in items:
        serialized.append(
            ContactListItemResponse.model_validate(
                {
                    **item.__dict__,
                    "duplicate_hints": hints.get(item.id, []),
                }
            )
        )
    return ContactListResponse(items=serialized, total=total, offset=offset, limit=limit)


@router.get("/{contact_id}", response_model=ContactResponse)
def contact_detail(contact_id: str, db: Session = Depends(db_session)) -> ContactResponse:
    item = get_contact(db, contact_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Contact not found.")
    hints = build_duplicate_hints([item])
    return ContactResponse.model_validate({**item.__dict__, "duplicate_hints": hints.get(item.id, [])})


@router.delete("/{contact_id}", response_model=MessageResponse)
def remove_contact(contact_id: str, db: Session = Depends(db_session)) -> MessageResponse:
    item = get_contact(db, contact_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Contact not found.")
    delete_contact(db, item)
    return MessageResponse(message="Contact deleted.")

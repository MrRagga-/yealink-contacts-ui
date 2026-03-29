from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from yealink_contacts.schemas.common import ORMModel, TimestampedResponse
from yealink_contacts.schemas.rules import RuleExplanation, SelectedPhone


class PhoneNumberResponse(TimestampedResponse):
    contact_id: str
    value: str
    normalized_e164: str | None = None
    type: str
    label: str | None = None
    is_primary: bool
    source_position: int
    is_valid: bool


class EmailResponse(TimestampedResponse):
    contact_id: str
    value: str
    type: str
    label: str | None = None
    is_primary: bool


class AddressResponse(TimestampedResponse):
    contact_id: str
    type: str
    label: str | None = None
    street: str | None = None
    city: str | None = None
    postal_code: str | None = None
    region: str | None = None
    country: str | None = None


class DuplicateHint(BaseModel):
    kind: str
    value: str
    related_contact_ids: list[str]
    score: float


class ContactResponse(TimestampedResponse):
    source_id: str
    source_contact_id: str
    full_name: str | None = None
    given_name: str | None = None
    family_name: str | None = None
    organization: str | None = None
    nickname: str | None = None
    notes: str | None = None
    groups: list[str] = Field(default_factory=list)
    photo_url: str | None = None
    raw_payload: dict[str, Any] = Field(default_factory=dict)
    content_hash: str
    updated_at_source: datetime | None = None
    last_synced_at: datetime | None = None
    phone_numbers: list[PhoneNumberResponse] = Field(default_factory=list)
    emails: list[EmailResponse] = Field(default_factory=list)
    addresses: list[AddressResponse] = Field(default_factory=list)
    duplicate_hints: list[DuplicateHint] = Field(default_factory=list)


class ContactListItemResponse(TimestampedResponse):
    source_id: str
    source_contact_id: str
    full_name: str | None = None
    given_name: str | None = None
    family_name: str | None = None
    organization: str | None = None
    nickname: str | None = None
    notes: str | None = None
    groups: list[str] = Field(default_factory=list)
    photo_url: str | None = None
    content_hash: str
    updated_at_source: datetime | None = None
    last_synced_at: datetime | None = None
    phone_numbers: list[PhoneNumberResponse] = Field(default_factory=list)
    emails: list[EmailResponse] = Field(default_factory=list)
    addresses: list[AddressResponse] = Field(default_factory=list)
    duplicate_hints: list[DuplicateHint] = Field(default_factory=list)


class ContactListResponse(BaseModel):
    items: list[ContactListItemResponse]
    total: int


class ExportPreviewItem(BaseModel):
    contact_id: str
    source_id: str
    source_name: str
    original_name: str | None = None
    display_name: str | None = None
    selected_numbers: list[SelectedPhone] = Field(default_factory=list)
    explanation: RuleExplanation
    duplicate_hints: list[DuplicateHint] = Field(default_factory=list)


class ExportPreviewResponse(BaseModel):
    profile_id: str
    profile_slug: str
    exported: list[ExportPreviewItem] = Field(default_factory=list)
    discarded: list[ExportPreviewItem] = Field(default_factory=list)
    generated_xml: str

from __future__ import annotations

from datetime import UTC, datetime

import phonenumbers

from yealink_contacts.adapters.base import CanonicalContactInput, CanonicalPhoneInput
from yealink_contacts.core.config import get_settings
from yealink_contacts.services.utils import collapse_whitespace

settings = get_settings()


def normalize_phone(raw_value: str, phone_type: str, label: str | None, position: int) -> CanonicalPhoneInput:
    value = collapse_whitespace(raw_value)
    normalized = None
    is_valid = False
    if value:
        try:
            parsed = phonenumbers.parse(value, settings.default_country_code)
            if phonenumbers.is_valid_number(parsed):
                normalized = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
                is_valid = True
        except phonenumbers.NumberParseException:
            normalized = None
    phone = CanonicalPhoneInput(
        value=value,
        normalized_e164=normalized,
        type=phone_type or "other",
        label=label,
        source_position=position,
    )
    phone.__dict__["is_valid"] = is_valid
    return phone


def normalize_contact_payload(contact: CanonicalContactInput) -> CanonicalContactInput:
    normalized_phones: list[CanonicalPhoneInput] = []
    for index, phone in enumerate(contact.phone_numbers):
        normalized_phones.append(
            normalize_phone(phone.value, phone.type, phone.label, phone.source_position or index)
        )

    parsed_updated_at: str | None = None
    if contact.updated_at:
        try:
            parsed_updated_at = datetime.fromisoformat(contact.updated_at).astimezone(UTC).isoformat()
        except ValueError:
            parsed_updated_at = None

    return contact.model_copy(
        update={
            "full_name": collapse_whitespace(contact.full_name or ""),
            "given_name": collapse_whitespace(contact.given_name or ""),
            "family_name": collapse_whitespace(contact.family_name or ""),
            "organization": collapse_whitespace(contact.organization or ""),
            "nickname": collapse_whitespace(contact.nickname or ""),
            "notes": contact.notes,
            "phone_numbers": normalized_phones,
            "updated_at": parsed_updated_at,
        }
    )

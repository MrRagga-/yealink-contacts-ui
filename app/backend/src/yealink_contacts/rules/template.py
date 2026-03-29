from __future__ import annotations

import re

from yealink_contacts.models.contact import Contact, ContactPhone
from yealink_contacts.services.utils import collapse_whitespace

PLACEHOLDER_PATTERN = re.compile(r"{([^{}]+)}")


def _get_field_value(contact: Contact, field_name: str) -> str:
    if field_name == "primary_phone":
        primary = next((phone for phone in contact.phone_numbers if phone.is_primary), None)
        return primary.value if primary else ""
    return str(getattr(contact, field_name, "") or "")


def render_name_expression(expression: str, contact: Contact, selected_phones: list[ContactPhone]) -> str:
    fallback_candidates = [candidate.strip() for candidate in expression.split("??")]

    for candidate in fallback_candidates:
        rendered = PLACEHOLDER_PATTERN.sub(
            lambda match: _get_field_value(contact, match.group(1).strip()),
            candidate,
        )
        if rendered == candidate and "{" not in candidate and "}" not in candidate:
            if candidate == "primary_phone" and selected_phones:
                rendered = selected_phones[0].value
            else:
                rendered = _get_field_value(contact, candidate)
        rendered = collapse_whitespace(rendered)
        if rendered:
            return rendered

    if selected_phones:
        return selected_phones[0].value
    return ""

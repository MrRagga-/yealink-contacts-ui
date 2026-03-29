from __future__ import annotations

from yealink_contacts.models.contact import Contact, ContactPhone
from yealink_contacts.rules.template import render_name_expression


def test_template_uses_fallback_phone_when_name_missing():
    contact = Contact(
        source_id="source-1",
        source_contact_id="contact-1",
        full_name=None,
        organization="Acme GmbH",
        content_hash="hash",
        raw_payload={},
        groups=[],
    )
    selected = [
        ContactPhone(
            value="+49 30 5555",
            normalized_e164="+49305555",
            type="work",
            source_position=0,
            is_valid=True,
        )
    ]

    result = render_name_expression("full_name ?? organization ?? primary_phone", contact, selected)

    assert result == "Acme GmbH"

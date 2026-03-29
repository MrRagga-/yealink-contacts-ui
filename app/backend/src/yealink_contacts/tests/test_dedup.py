from __future__ import annotations

from yealink_contacts.dedup.service import DuplicateDetector
from yealink_contacts.models.contact import Contact, ContactEmail, ContactPhone


def test_duplicate_detector_marks_same_phone_and_email():
    left = Contact(id="a", source_id="s1", source_contact_id="1", full_name="Max Mustermann", content_hash="1", raw_payload={}, groups=[])
    left.phone_numbers = [ContactPhone(value="+49 1", normalized_e164="+491", type="mobile", source_position=0, is_valid=True)]
    left.emails = [ContactEmail(value="max@example.com", type="work", is_primary=True)]

    right = Contact(id="b", source_id="s2", source_contact_id="2", full_name="Max Mustermann", content_hash="2", raw_payload={}, groups=[])
    right.phone_numbers = [ContactPhone(value="+49 1", normalized_e164="+491", type="work", source_position=0, is_valid=True)]
    right.emails = [ContactEmail(value="max@example.com", type="home", is_primary=True)]

    hints = DuplicateDetector().build_hints([left, right])

    assert any(item.kind == "phone" for item in hints["a"])
    assert any(item.kind == "email" for item in hints["b"])

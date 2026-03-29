from __future__ import annotations

from yealink_contacts.models.contact import Contact, ContactPhone
from yealink_contacts.models.source import Source, SourceType
from yealink_contacts.services.export_service import list_export_profiles


def test_preview_and_xml_endpoints(client, db):
    source = Source(
        name="Demo",
        slug="demo",
        type=SourceType.carddav,
        is_active=True,
        tags=[],
    )
    db.add(source)
    db.flush()

    contact = Contact(
        source_id=source.id,
        source_contact_id="external-1",
        full_name="Grace Hopper",
        content_hash="hash",
        raw_payload={},
        groups=[],
    )
    contact.phone_numbers = [
        ContactPhone(
            value="+49 40 123",
            normalized_e164="+4940123",
            type="work",
            source_position=0,
            is_primary=True,
            is_valid=True,
        )
    ]
    db.add(contact)

    db.commit()
    profile = list_export_profiles(db)[0]

    preview = client.get(f"/api/exports/preview?profile_id={profile.id}")
    xml = client.get("/api/yealink/phonebook/default.xml")

    assert preview.status_code == 200
    assert preview.json()["exported"][0]["display_name"] == "Grace Hopper"
    assert xml.status_code == 200
    assert "Grace Hopper" in xml.text

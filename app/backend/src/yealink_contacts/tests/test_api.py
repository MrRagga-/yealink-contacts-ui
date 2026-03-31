from __future__ import annotations

import yealink_contacts.api.sources as source_api
from yealink_contacts.models.contact import Contact, ContactPhone
from yealink_contacts.models.source import Source, SourceType
from yealink_contacts.core.config import get_settings
from yealink_contacts.services.export_service import list_export_profiles


def test_preview_and_xml_endpoints(admin_client, db):
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

    preview = admin_client.get(f"/api/exports/preview?profile_id={profile.id}")
    xml = admin_client.get("/api/yealink/phonebook/default.xml")

    assert preview.status_code == 200
    assert preview.json()["exported"][0]["display_name"] == "Grace Hopper"
    assert xml.status_code == 200
    assert "Grace Hopper" in xml.text
    assert xml.headers["x-cache"] == "MISS"

    cached = admin_client.get("/api/yealink/phonebook/default.xml")
    assert cached.status_code == 200
    assert cached.headers["x-cache"] == "HIT"

    not_modified = admin_client.get(
        "/api/yealink/phonebook/default.xml",
        headers={"If-None-Match": cached.headers["etag"]},
    )
    assert not_modified.status_code == 304


def test_xml_cache_is_invalidated_when_contact_is_deleted(admin_client, db):
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
        source_contact_id="external-2",
        full_name="Ada Lovelace",
        content_hash="hash",
        raw_payload={},
        groups=[],
    )
    contact.phone_numbers = [
        ContactPhone(
            value="+49 30 123",
            normalized_e164="+4930123",
            type="work",
            source_position=0,
            is_primary=True,
            is_valid=True,
        )
    ]
    db.add(contact)
    db.commit()

    first = admin_client.get("/api/yealink/phonebook/default.xml")
    assert first.status_code == 200
    assert "Ada Lovelace" in first.text

    deleted = admin_client.delete(f"/api/contacts/{contact.id}")
    assert deleted.status_code == 200

    second = admin_client.get("/api/yealink/phonebook/default.xml")
    assert second.status_code == 200
    assert "Ada Lovelace" not in second.text
    assert second.headers["x-cache"] == "HIT"


def test_google_oauth_callback_uses_configured_https_redirect(admin_client, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "frontend_origin", "https://yealink-contacts-ui.weismueller.org")

    created = admin_client.post(
        "/api/sources",
        json={
            "name": "Google Jonas",
            "slug": "google-jonas",
            "type": "google",
            "is_active": True,
            "notes": "",
            "tags": [],
            "credential": {
                "google_client_id": "client-id",
                "google_client_secret": "client-secret",
                "google_redirect_uri": "https://yealink-contacts-ui-callback.weismueller.org/api/sources/oauth/google/callback",
            },
            "addressbooks": [],
        },
    )
    assert created.status_code == 200
    source_id = created.json()["id"]

    captured: dict[str, str] = {}

    def fake_complete_google_oauth(db, source, callback_url: str):
        captured["callback_url"] = callback_url
        return source

    monkeypatch.setattr(source_api, "complete_google_oauth", fake_complete_google_oauth)

    response = admin_client.get(
        f"/api/sources/oauth/google/callback?state={source_id}&code=oauth-code",
        follow_redirects=False,
    )

    assert response.status_code == 307
    assert captured["callback_url"] == (
        "https://yealink-contacts-ui-callback.weismueller.org/api/sources/oauth/google/callback"
        f"?state={source_id}&code=oauth-code"
    )
    assert response.headers["location"] == (
        f"https://yealink-contacts-ui.weismueller.org/sources?google=connected&sourceId={source_id}"
    )

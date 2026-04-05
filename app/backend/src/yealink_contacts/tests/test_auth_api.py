from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select

import yealink_contacts.main as app_main
from yealink_contacts.models.app_setting import AppSetting
from yealink_contacts.models.auth import AdminUser, PasskeyCredential
from yealink_contacts.services.network_security import resolve_client_ip


@dataclass
class DummyVerifiedRegistration:
    credential_id: bytes
    credential_public_key: bytes
    sign_count: int


@dataclass
class DummyVerifiedAuthentication:
    new_sign_count: int


def test_bootstrap_login_requires_password_change(client):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "admin"})

    assert login.status_code == 200
    assert login.json()["must_change_password"] is True

    me = client.get("/api/auth/me")

    assert me.status_code == 200
    assert me.json()["must_change_password"] is True


def test_forced_password_change_blocks_admin_routes_until_completed(client):
    client.post("/api/auth/login", json={"username": "admin", "password": "admin"})

    blocked = client.get("/api/dashboard")
    assert blocked.status_code == 403

    changed = client.post(
        "/api/auth/change-password",
        json={"current_password": "admin", "new_password": "admin-password"},
    )

    assert changed.status_code == 200
    assert changed.json()["must_change_password"] is False

    dashboard = client.get("/api/dashboard")
    assert dashboard.status_code == 200


def test_admin_routes_require_auth_and_docs_are_not_public(client):
    dashboard = client.get("/api/dashboard")
    docs = client.get("/docs")

    assert dashboard.status_code == 401
    assert docs.status_code == 401


def test_admin_and_xml_acl_lists_are_enforced(client, db):
    db.add(AppSetting(key="admin_allowed_cidrs", value=["10.0.0.0/8"]))
    db.add(AppSetting(key="xml_allowed_cidrs", value=["10.0.0.0/8"]))
    db.commit()

    headers = {"X-Forwarded-For": "203.0.113.25"}
    login = client.post("/api/auth/login", json={"username": "admin", "password": "admin"}, headers=headers)
    xml = client.get("/api/yealink/phonebook/default.xml", headers=headers)

    assert login.status_code == 403
    assert xml.status_code == 403


def test_localhost_is_never_blocked_by_acl_lists(client, db):
    db.add(AppSetting(key="admin_allowed_cidrs", value=["10.0.0.0/8"]))
    db.add(AppSetting(key="xml_allowed_cidrs", value=["10.0.0.0/8"]))
    db.commit()

    dashboard = client.get("/api/dashboard")
    xml = client.get("/api/yealink/phonebook/default.xml")

    assert dashboard.status_code == 401
    assert xml.status_code == 200


def test_admin_acl_can_be_overridden_from_environment(client, db, monkeypatch):
    db.add(AppSetting(key="admin_allowed_cidrs", value=["10.0.0.0/8"]))
    db.commit()
    monkeypatch.setattr(app_main.settings, "admin_allowed_cidrs_override", ["0.0.0.0/0", "::/0"])

    login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin"},
        headers={"X-Forwarded-For": "203.0.113.25"},
    )

    assert login.status_code == 200


def test_trusted_proxy_resolution_prefers_forwarded_ip_only_for_trusted_proxies():
    trusted = ["10.0.0.0/8"]

    forwarded = resolve_client_ip("10.10.10.10", "203.0.113.50, 10.10.10.10", trusted)
    direct = resolve_client_ip("192.168.1.5", "203.0.113.50, 192.168.1.5", trusted)

    assert str(forwarded) == "203.0.113.50"
    assert str(direct) == "192.168.1.5"


def test_trusted_proxy_resolution_normalizes_ipv4_mapped_forwarded_addresses():
    trusted = ["127.0.0.0/8"]

    forwarded = resolve_client_ip("127.0.0.1", "::ffff:192.168.23.50", trusted)

    assert str(forwarded) == "192.168.23.50"


def test_debug_acl_logging_reports_resolved_client_ip(client, db, monkeypatch):
    captured: list[dict[str, object]] = []

    class DummyLogger:
        def info(self, event: str, **fields: object) -> None:
            captured.append({"event": event, **fields})

    monkeypatch.setattr(app_main, "logger", DummyLogger())
    monkeypatch.setattr(app_main.settings, "trusted_proxy_cidrs", [])

    db.add(AppSetting(key="debug_enabled", value=True))
    db.add(AppSetting(key="admin_allowed_cidrs", value=["192.168.23.0/24"]))
    db.commit()

    response = client.get("/api/dashboard", headers={"X-Forwarded-For": "192.168.23.254"})

    assert response.status_code == 401
    assert captured == [
        {
            "event": "acl_ip_debug",
            "path": "/api/dashboard",
            "method": "GET",
            "scope": "admin",
            "peer_host": "testclient",
            "x_forwarded_for": "192.168.23.254",
            "trusted_proxy_cidrs": ["127.0.0.0/8", "::1/128"],
            "resolved_client_ip": "192.168.23.254",
            "allowed_cidrs": ["127.0.0.0/8", "::1/128", "192.168.23.0/24"],
            "allowed": True,
        }
    ]


def test_passkey_registration_and_authentication_flow(admin_client, db, monkeypatch):
    monkeypatch.setattr(
        "yealink_contacts.services.auth_service.verify_registration_response",
        lambda **_: DummyVerifiedRegistration(
            credential_id=b"cred-1",
            credential_public_key=b"public-key",
            sign_count=1,
        ),
    )
    monkeypatch.setattr(
        "yealink_contacts.services.auth_service.verify_authentication_response",
        lambda **_: DummyVerifiedAuthentication(new_sign_count=2),
    )

    options = admin_client.post(
        "/api/auth/passkeys/registration/options",
        json={"label": "Laptop"},
    )
    assert options.status_code == 200
    assert "options" in options.json()

    created = admin_client.post(
        "/api/auth/passkeys/registration/verify",
        json={
            "credential": {
                "id": "cred-1",
                "response": {"transports": ["internal"]},
            }
        },
    )
    assert created.status_code == 201
    assert created.json()["label"] == "Laptop"

    stored_admin = db.execute(select(AdminUser).where(AdminUser.username == "admin")).scalar_one()
    stored_passkey = db.execute(
        select(PasskeyCredential).where(PasskeyCredential.admin_user_id == stored_admin.id)
    ).scalar_one()
    assert stored_passkey.credential_id == "Y3JlZC0x"

    admin_client.post("/api/auth/logout")
    auth_options = admin_client.post("/api/auth/passkeys/authentication/options")
    assert auth_options.status_code == 200

    auth_verify = admin_client.post(
        "/api/auth/passkeys/authentication/verify",
        json={"credential": {"id": stored_passkey.credential_id}},
    )

    assert auth_verify.status_code == 200
    assert auth_verify.json()["username"] == "admin"


def test_duplicate_source_slug_returns_conflict(admin_client):
    payload = {
        "name": "Google Demo",
        "slug": "google-demo",
        "type": "google",
        "is_active": True,
        "notes": "",
        "tags": [],
        "credential": {
            "merge_strategy": "upsert_only",
            "google_client_id": "client-id",
            "google_client_secret": "client-secret",
            "google_redirect_uri": "http://localhost:8000/api/sources/oauth/google/callback",
            "google_auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        },
        "addressbooks": [],
    }

    first = admin_client.post("/api/sources", json=payload)
    second = admin_client.post("/api/sources", json=payload)

    assert first.status_code == 200
    assert second.status_code == 409
    assert second.json()["detail"] == "A source with this slug already exists."

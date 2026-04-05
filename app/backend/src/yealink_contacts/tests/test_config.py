from __future__ import annotations

from types import SimpleNamespace

from yealink_contacts.core.config import LOCALHOST_CIDRS, Settings


def test_dev_environment_uses_dev_database_url_for_local_non_docker(monkeypatch):
    monkeypatch.setattr("yealink_contacts.core.config.DOCKER_ENV_MARKER", SimpleNamespace(exists=lambda: False))

    settings = Settings.model_validate(
        {
            "APP_ENV": "development",
            "DATABASE_URL": "postgresql+psycopg://postgres:postgres@db:5432/yealink_contacts",
            "DEV_DATABASE_URL": "sqlite:///./yealink_contacts.db",
            "APP_SECRET_KEY": "test-secret",
            "ENCRYPTION_KEY": "S4aexYnjREGeQkSQIlPCXSQLgXUhY_GfJ1i1n1a34zg=",
        }
    )

    assert settings.resolved_database_url == "sqlite:///./yealink_contacts.db"


def test_non_dev_or_container_runtime_keeps_database_url(monkeypatch):
    monkeypatch.setattr("yealink_contacts.core.config.DOCKER_ENV_MARKER", SimpleNamespace(exists=lambda: True))

    settings = Settings.model_validate(
        {
            "APP_ENV": "development",
            "DATABASE_URL": "postgresql+psycopg://postgres:postgres@db:5432/yealink_contacts",
            "DEV_DATABASE_URL": "sqlite:///./yealink_contacts.db",
            "APP_SECRET_KEY": "test-secret",
            "ENCRYPTION_KEY": "S4aexYnjREGeQkSQIlPCXSQLgXUhY_GfJ1i1n1a34zg=",
        }
    )

    assert settings.resolved_database_url == "postgresql+psycopg://postgres:postgres@db:5432/yealink_contacts"


def test_dev_environment_trusts_loopback_proxies_by_default():
    settings = Settings.model_validate(
        {
            "APP_ENV": "development",
            "DATABASE_URL": "sqlite:///./yealink_contacts.db",
            "APP_SECRET_KEY": "test-secret",
            "ENCRYPTION_KEY": "S4aexYnjREGeQkSQIlPCXSQLgXUhY_GfJ1i1n1a34zg=",
        }
    )

    assert settings.resolved_trusted_proxy_cidrs == ["127.0.0.0/8", "::1/128"]


def test_allowed_cidr_overrides_include_localhost_and_replace_persisted_lists():
    settings = Settings.model_validate(
        {
            "APP_ENV": "development",
            "DATABASE_URL": "sqlite:///./yealink_contacts.db",
            "APP_SECRET_KEY": "test-secret",
            "ENCRYPTION_KEY": "S4aexYnjREGeQkSQIlPCXSQLgXUhY_GfJ1i1n1a34zg=",
            "ADMIN_ALLOWED_CIDRS_OVERRIDE": "203.0.113.0/24",
            "XML_ALLOWED_CIDRS_OVERRIDE": "198.51.100.0/24",
        }
    )

    assert settings.resolve_admin_allowed_cidrs(["10.0.0.0/8"]) == [*LOCALHOST_CIDRS, "203.0.113.0/24"]
    assert settings.resolve_xml_allowed_cidrs(["10.0.0.0/8"]) == [*LOCALHOST_CIDRS, "198.51.100.0/24"]

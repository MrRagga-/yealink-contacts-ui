from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[5]
DOCKER_ENV_MARKER = Path("/.dockerenv")


class Settings(BaseSettings):
    app_name: str = Field(default="Yealink Contacts Sync", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    frontend_origin: str = Field(default="http://localhost:5173", alias="FRONTEND_ORIGIN")
    database_url: str = Field(default="sqlite:///./yealink_contacts.db", alias="DATABASE_URL")
    dev_database_url: str = Field(default="sqlite:///./yealink_contacts.db", alias="DEV_DATABASE_URL")
    app_secret_key: str = Field(alias="APP_SECRET_KEY")
    encryption_key: str = Field(alias="ENCRYPTION_KEY")
    default_country_code: str = Field(default="DE", alias="DEFAULT_COUNTRY_CODE")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    xml_public_base_url: str | None = Field(default=None, alias="XML_PUBLIC_BASE_URL")
    sync_http_timeout: int = Field(default=20, alias="SYNC_HTTP_TIMEOUT")
    trusted_proxy_cidrs: list[str] = Field(default_factory=list, alias="TRUSTED_PROXY_CIDRS")
    session_cookie_name: str = Field(default="yealink_admin_session", alias="SESSION_COOKIE_NAME")
    session_max_age_seconds: int = Field(default=60 * 60 * 12, alias="SESSION_MAX_AGE_SECONDS")
    webauthn_rp_id: str | None = Field(default=None, alias="WEBAUTHN_RP_ID")
    webauthn_rp_name: str | None = Field(default=None, alias="WEBAUTHN_RP_NAME")
    webauthn_rp_origin: str | None = Field(default=None, alias="WEBAUTHN_RP_ORIGIN")

    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("trusted_proxy_cidrs", mode="before")
    @classmethod
    def split_trusted_proxy_cidrs(cls, value: str | list[str] | None) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def resolved_webauthn_rp_origin(self) -> str:
        return self.webauthn_rp_origin or self.frontend_origin

    @property
    def resolved_webauthn_rp_name(self) -> str:
        return self.webauthn_rp_name or self.app_name

    @property
    def resolved_webauthn_rp_id(self) -> str:
        if self.webauthn_rp_id:
            return self.webauthn_rp_id
        hostname = urlparse(self.resolved_webauthn_rp_origin).hostname
        if not hostname:
            raise ValueError("Unable to determine WebAuthn RP ID from frontend origin.")
        return hostname

    @property
    def resolved_database_url(self) -> str:
        database_host = urlparse(self.database_url).hostname
        if (
            self.app_env == "development"
            and database_host == "db"
            and self.dev_database_url
            and not DOCKER_ENV_MARKER.exists()
        ):
            return self.dev_database_url
        return self.database_url


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # ty: ignore[missing-argument]

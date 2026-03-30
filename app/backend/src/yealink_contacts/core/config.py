from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[5]


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

    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # ty: ignore[missing-argument]

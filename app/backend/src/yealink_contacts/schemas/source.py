from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from yealink_contacts.models.source import SourceMergeStrategy, SourceType
from yealink_contacts.schemas.common import ORMModel, TimestampedResponse


class SourceCredentialPayload(BaseModel):
    merge_strategy: SourceMergeStrategy = SourceMergeStrategy.upsert_only
    server_url: str | None = None
    username: str | None = None
    password: str | None = None
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str | None = None
    google_auth_uri: str | None = None
    google_code_verifier: str | None = None
    refresh_token: str | None = None
    access_token: str | None = None
    token_uri: str | None = None
    account_email: str | None = None


class SourceAddressbookBase(BaseModel):
    remote_id: str
    href: str
    display_name: str
    description: str | None = None
    is_selected: bool = False
    sync_token: str | None = None


class SourceAddressbookResponse(TimestampedResponse, SourceAddressbookBase):
    source_id: str


class SourceBase(BaseModel):
    name: str
    slug: str
    type: SourceType
    is_active: bool = True
    notes: str | None = None
    tags: list[str] = Field(default_factory=list)


class SourceCreate(SourceBase):
    credential: SourceCredentialPayload = Field(default_factory=SourceCredentialPayload)
    addressbooks: list[SourceAddressbookBase] = Field(default_factory=list)


class SourceUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    is_active: bool | None = None
    notes: str | None = None
    tags: list[str] | None = None
    credential: SourceCredentialPayload | None = None
    addressbooks: list[SourceAddressbookBase] | None = None


class CardDavCredentialSummary(BaseModel):
    merge_strategy: SourceMergeStrategy = SourceMergeStrategy.upsert_only
    server_url: str | None = None
    username: str | None = None


class GoogleCredentialSummary(BaseModel):
    merge_strategy: SourceMergeStrategy = SourceMergeStrategy.upsert_only
    account_email: str | None = None
    google_client_id: str | None = None
    google_redirect_uri: str | None = None
    google_auth_uri: str | None = None
    token_uri: str | None = None
    google_client_secret_configured: bool = False
    google_refresh_token_configured: bool = False


SourceCredentialSummary = CardDavCredentialSummary | GoogleCredentialSummary


class SourceResponse(TimestampedResponse, SourceBase):
    last_successful_sync_at: datetime | None = None
    last_error: str | None = None
    addressbooks: list[SourceAddressbookResponse] = Field(default_factory=list)
    credential_summary: SourceCredentialSummary = Field(default_factory=CardDavCredentialSummary)


class SourceTestResponse(BaseModel):
    ok: bool
    message: str
    capabilities: dict[str, object] = Field(default_factory=dict)
    addressbooks: list[SourceAddressbookBase] = Field(default_factory=list)


class GoogleAuthStartResponse(BaseModel):
    authorization_url: str

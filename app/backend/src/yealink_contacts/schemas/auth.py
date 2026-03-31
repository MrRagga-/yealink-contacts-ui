from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class AuthenticatedAdminResponse(BaseModel):
    id: str
    username: str
    must_change_password: bool
    is_active: bool
    passkey_count: int


class PasskeyCredentialResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    label: str
    transports: list[str]
    created_at: datetime
    updated_at: datetime
    last_used_at: datetime | None = None


class PasskeyRegistrationOptionsRequest(BaseModel):
    label: str = Field(default="Passkey", min_length=1, max_length=120)


class PublicKeyOptionsResponse(BaseModel):
    options: dict[str, Any]


class PasskeyRegistrationVerifyRequest(BaseModel):
    credential: dict[str, Any]


class PasskeyAuthenticationVerifyRequest(BaseModel):
    credential: dict[str, Any]

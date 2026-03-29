from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel, Field


class CanonicalPhoneInput(BaseModel):
    value: str
    normalized_e164: str | None = None
    type: str = "other"
    label: str | None = None
    is_primary: bool = False
    source_position: int = 0


class CanonicalEmailInput(BaseModel):
    value: str
    type: str = "other"
    label: str | None = None
    is_primary: bool = False


class CanonicalAddressInput(BaseModel):
    type: str = "other"
    label: str | None = None
    street: str | None = None
    city: str | None = None
    postal_code: str | None = None
    region: str | None = None
    country: str | None = None


class CanonicalContactInput(BaseModel):
    source_contact_id: str
    full_name: str | None = None
    given_name: str | None = None
    family_name: str | None = None
    organization: str | None = None
    nickname: str | None = None
    notes: str | None = None
    emails: list[CanonicalEmailInput] = Field(default_factory=list)
    phone_numbers: list[CanonicalPhoneInput] = Field(default_factory=list)
    addresses: list[CanonicalAddressInput] = Field(default_factory=list)
    groups: list[str] = Field(default_factory=list)
    photo_url: str | None = None
    raw_payload: dict = Field(default_factory=dict)
    updated_at: str | None = None


class AddressbookInfo(BaseModel):
    remote_id: str
    href: str
    display_name: str
    description: str | None = None
    sync_token: str | None = None


class SourceAdapter(ABC):
    @abstractmethod
    def test_connection(self) -> tuple[bool, str]:
        raise NotImplementedError

    @abstractmethod
    def list_addressbooks(self) -> list[AddressbookInfo]:
        raise NotImplementedError

    @abstractmethod
    def fetch_contacts(self) -> list[CanonicalContactInput]:
        raise NotImplementedError

    @abstractmethod
    def fetch_contact_by_id(self, contact_id: str) -> CanonicalContactInput | None:
        raise NotImplementedError

    @abstractmethod
    def get_capabilities(self) -> dict:
        raise NotImplementedError


class OutputAdapter(ABC):
    @abstractmethod
    def preview(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def render(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def content_type(self) -> str:
        raise NotImplementedError

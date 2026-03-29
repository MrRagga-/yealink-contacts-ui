from __future__ import annotations

from pydantic import BaseModel, Field

from yealink_contacts.schemas.common import TimestampedResponse
from yealink_contacts.schemas.rules import RuleSetConfig


class ExportProfileBase(BaseModel):
    name: str
    slug: str
    description: str | None = None
    is_active: bool = True
    sort_order: int = 0
    metadata: dict = Field(default_factory=dict)


class ExportProfileCreate(ExportProfileBase):
    rule_set: RuleSetConfig = Field(default_factory=RuleSetConfig)


class ExportProfileUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    metadata: dict | None = None
    rule_set: RuleSetConfig | None = None


class ExportProfileResponse(TimestampedResponse, ExportProfileBase):
    rule_set: RuleSetConfig = Field(default_factory=RuleSetConfig)
    xml_url: str

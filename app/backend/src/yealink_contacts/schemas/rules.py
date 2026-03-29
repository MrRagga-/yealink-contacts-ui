from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

PhoneType = Literal["mobile", "work", "home", "main", "fax", "other", "custom"]


class NameTemplateConfig(BaseModel):
    expression: str = "{full_name}"
    prefix: str = ""
    suffix: str = ""
    normalize_whitespace: bool = True


class PhoneSelectionConfig(BaseModel):
    allowed_types: list[PhoneType] = Field(default_factory=lambda: ["mobile", "work", "main", "home"])
    excluded_types: list[PhoneType] = Field(default_factory=lambda: ["fax"])
    priority_order: list[PhoneType] = Field(
        default_factory=lambda: ["mobile", "work", "main", "home", "other", "custom"]
    )
    require_phone: bool = True
    max_numbers_per_contact: int = 1
    normalize_to_e164: bool = True


class ContactFilterConfig(BaseModel):
    include_source_ids: list[str] = Field(default_factory=list)
    exclude_source_ids: list[str] = Field(default_factory=list)
    include_groups: list[str] = Field(default_factory=list)
    search_query: str | None = None
    blacklist_contact_ids: list[str] = Field(default_factory=list)
    blacklist_numbers: list[str] = Field(default_factory=list)
    require_phone: bool = True


class RuleSetConfig(BaseModel):
    filters: ContactFilterConfig = Field(default_factory=ContactFilterConfig)
    phone_selection: PhoneSelectionConfig = Field(default_factory=PhoneSelectionConfig)
    name_template: NameTemplateConfig = Field(default_factory=NameTemplateConfig)


class SelectedPhone(BaseModel):
    value: str
    normalized_e164: str | None = None
    type: str
    label: str | None = None
    source_position: int = 0


class RuleExplanation(BaseModel):
    included: bool
    display_name: str | None = None
    reasons: list[str] = Field(default_factory=list)
    selected_numbers: list[SelectedPhone] = Field(default_factory=list)
    discarded_numbers: list[str] = Field(default_factory=list)

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from yealink_contacts.models.source import SourceMergeStrategy, SourceType
from yealink_contacts.services.network_security import ALLOW_ALL_CIDRS, normalize_cidrs


def _normalize_optional_cidrs(value: list[str] | None) -> list[str] | None:
    if value is None:
        return None
    return normalize_cidrs(value)


class AppSettingsBase(BaseModel):
    default_new_source_type: SourceType = SourceType.carddav
    default_new_source_merge_strategy: SourceMergeStrategy = SourceMergeStrategy.upsert_only
    default_profile_allowed_types: list[str] = Field(default_factory=lambda: ["mobile", "work", "main", "home"])
    default_profile_excluded_types: list[str] = Field(default_factory=lambda: ["fax"])
    default_profile_priority_order: list[str] = Field(
        default_factory=lambda: ["mobile", "work", "main", "home", "other", "custom"]
    )
    default_profile_max_numbers_per_contact: int = 2
    default_profile_name_expression: str = "{full_name}"
    default_profile_prefix: str = ""
    default_profile_suffix: str = ""
    debug_enabled: bool = False
    admin_allowed_cidrs: list[str] = Field(default_factory=lambda: ALLOW_ALL_CIDRS.copy())
    xml_allowed_cidrs: list[str] = Field(default_factory=lambda: ALLOW_ALL_CIDRS.copy())

    @field_validator("admin_allowed_cidrs", "xml_allowed_cidrs", mode="before")
    @classmethod
    def normalize_cidr_fields(cls, value: list[str] | None) -> list[str] | None:
        return _normalize_optional_cidrs(value)


class AppSettingsResponse(AppSettingsBase):
    app_version: str = "0.2.5"
    release_model: str = "Semantic Versioning via Git tags"


class AppSettingsUpdate(BaseModel):
    default_new_source_type: SourceType | None = None
    default_new_source_merge_strategy: SourceMergeStrategy | None = None
    default_profile_allowed_types: list[str] | None = None
    default_profile_excluded_types: list[str] | None = None
    default_profile_priority_order: list[str] | None = None
    default_profile_max_numbers_per_contact: int | None = None
    default_profile_name_expression: str | None = None
    default_profile_prefix: str | None = None
    default_profile_suffix: str | None = None
    debug_enabled: bool | None = None
    admin_allowed_cidrs: list[str] | None = None
    xml_allowed_cidrs: list[str] | None = None

    @field_validator("admin_allowed_cidrs", "xml_allowed_cidrs", mode="before")
    @classmethod
    def normalize_cidr_fields(cls, value: list[str] | None) -> list[str] | None:
        return _normalize_optional_cidrs(value)

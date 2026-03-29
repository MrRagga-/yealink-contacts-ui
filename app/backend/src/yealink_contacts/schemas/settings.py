from __future__ import annotations

from pydantic import BaseModel, Field

from yealink_contacts.models.source import SourceMergeStrategy, SourceType


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


class AppSettingsResponse(AppSettingsBase):
    app_version: str = "0.1.0"
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

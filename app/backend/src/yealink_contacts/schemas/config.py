from __future__ import annotations

from pydantic import BaseModel, Field

from yealink_contacts.schemas.export_profile import ExportProfileCreate
from yealink_contacts.schemas.settings import AppSettingsResponse
from yealink_contacts.schemas.source import SourceCreate


class AppConfigExport(BaseModel):
    settings: AppSettingsResponse = Field(default_factory=AppSettingsResponse)
    sources: list[SourceCreate] = Field(default_factory=list)
    export_profiles: list[ExportProfileCreate] = Field(default_factory=list)

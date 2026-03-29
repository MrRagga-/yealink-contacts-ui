from __future__ import annotations

from pydantic import BaseModel, Field


class DashboardResponse(BaseModel):
    source_count: int
    active_source_count: int
    export_profile_count: int
    contact_count: int
    exported_contact_count: int
    last_sync: str | None = None
    xml_endpoints: list[str] = Field(default_factory=list)
    recent_errors: list[str] = Field(default_factory=list)

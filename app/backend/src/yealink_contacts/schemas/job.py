from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from yealink_contacts.models.job import SyncJobStatus
from yealink_contacts.schemas.common import TimestampedResponse


class SyncJobEventResponse(TimestampedResponse):
    sync_job_id: str
    level: str
    message: str
    details: dict = Field(default_factory=dict)


class SyncJobResponse(TimestampedResponse):
    source_id: str | None = None
    status: SyncJobStatus
    trigger_type: str
    started_at: datetime | None = None
    finished_at: datetime | None = None
    summary: dict = Field(default_factory=dict)
    error_message: str | None = None
    events: list[SyncJobEventResponse] = Field(default_factory=list)

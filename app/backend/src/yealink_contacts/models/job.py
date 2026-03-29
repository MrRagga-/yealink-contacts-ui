from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from yealink_contacts.db.base import Base
from yealink_contacts.models.common import IdTimestampMixin


class SyncJobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"


class SyncJob(IdTimestampMixin, Base):
    __tablename__ = "sync_jobs"

    source_id: Mapped[str | None] = mapped_column(ForeignKey("sources.id"), nullable=True)
    status: Mapped[SyncJobStatus] = mapped_column(Enum(SyncJobStatus), default=SyncJobStatus.pending)
    trigger_type: Mapped[str] = mapped_column(String(32), default="manual")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    source: Mapped["Source | None"] = relationship(back_populates="sync_jobs")
    events: Mapped[list["SyncJobEvent"]] = relationship(
        back_populates="job",
        cascade="all, delete-orphan",
    )


class SyncJobEvent(IdTimestampMixin, Base):
    __tablename__ = "sync_job_events"

    sync_job_id: Mapped[str] = mapped_column(ForeignKey("sync_jobs.id", ondelete="CASCADE"))
    level: Mapped[str] = mapped_column(String(16), default="info")
    message: Mapped[str] = mapped_column(Text)
    details: Mapped[dict] = mapped_column(JSON, default=dict)

    job: Mapped[SyncJob] = relationship(back_populates="events")


from yealink_contacts.models.source import Source  # noqa: E402

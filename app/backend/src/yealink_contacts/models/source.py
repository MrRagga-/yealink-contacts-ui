from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from yealink_contacts.db.base import Base
from yealink_contacts.models.common import IdTimestampMixin


class SourceType(str, enum.Enum):
    google = "google"
    carddav = "carddav"
    nextcloud_carddav = "nextcloud_carddav"


class SourceMergeStrategy(str, enum.Enum):
    upsert_only = "upsert_only"
    mirror_source = "mirror_source"


class Source(IdTimestampMixin, Base):
    __tablename__ = "sources"

    name: Mapped[str] = mapped_column(String(120), unique=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    type: Mapped[SourceType] = mapped_column(Enum(SourceType))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    last_successful_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    credential: Mapped["SourceCredential | None"] = relationship(
        back_populates="source",
        cascade="all, delete-orphan",
        uselist=False,
    )
    addressbooks: Mapped[list["SourceAddressbook"]] = relationship(
        back_populates="source",
        cascade="all, delete-orphan",
    )
    contacts: Mapped[list["Contact"]] = relationship(
        back_populates="source",
        cascade="all, delete-orphan",
    )
    sync_jobs: Mapped[list["SyncJob"]] = relationship(back_populates="source")


class SourceCredential(IdTimestampMixin, Base):
    __tablename__ = "source_credentials"

    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), unique=True)
    encrypted_payload: Mapped[str] = mapped_column(Text)

    source: Mapped[Source] = relationship(back_populates="credential")


class SourceAddressbook(IdTimestampMixin, Base):
    __tablename__ = "source_addressbooks"

    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"))
    remote_id: Mapped[str] = mapped_column(String(255))
    href: Mapped[str] = mapped_column(String(512))
    display_name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False)
    sync_token: Mapped[str | None] = mapped_column(String(255), nullable=True)

    source: Mapped[Source] = relationship(back_populates="addressbooks")


from yealink_contacts.models.contact import Contact  # noqa: E402
from yealink_contacts.models.job import SyncJob  # noqa: E402

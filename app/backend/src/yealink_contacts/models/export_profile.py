from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from yealink_contacts.db.base import Base
from yealink_contacts.models.common import IdTimestampMixin


class ExportProfile(IdTimestampMixin, Base):
    __tablename__ = "export_profiles"

    name: Mapped[str] = mapped_column(String(120), unique=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)

    rule_set: Mapped["RuleSet | None"] = relationship(
        back_populates="export_profile",
        cascade="all, delete-orphan",
        uselist=False,
    )


class RuleSet(IdTimestampMixin, Base):
    __tablename__ = "rule_sets"

    export_profile_id: Mapped[str] = mapped_column(
        ForeignKey("export_profiles.id", ondelete="CASCADE"),
        unique=True,
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    rules_json: Mapped[dict] = mapped_column("rules", JSON, default=dict)

    export_profile: Mapped[ExportProfile] = relationship(back_populates="rule_set")

from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from yealink_contacts.db.base import Base
from yealink_contacts.models.common import IdTimestampMixin


class AppSetting(IdTimestampMixin, Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    value: Mapped[dict | list | str | int | bool | None] = mapped_column(JSON, nullable=True)

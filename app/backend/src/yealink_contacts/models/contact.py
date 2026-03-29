from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from yealink_contacts.db.base import Base
from yealink_contacts.models.common import IdTimestampMixin


class Contact(IdTimestampMixin, Base):
    __tablename__ = "contacts"

    source_id: Mapped[str] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), index=True)
    source_contact_id: Mapped[str] = mapped_column(String(255), index=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    given_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    family_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    organization: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nickname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    groups: Mapped[list[str]] = mapped_column(JSON, default=list)
    photo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    raw_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    content_hash: Mapped[str] = mapped_column(String(128), index=True)
    updated_at_source: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    source: Mapped["Source"] = relationship(back_populates="contacts")
    phone_numbers: Mapped[list["ContactPhone"]] = relationship(
        back_populates="contact",
        cascade="all, delete-orphan",
        order_by="ContactPhone.source_position",
    )
    emails: Mapped[list["ContactEmail"]] = relationship(
        back_populates="contact",
        cascade="all, delete-orphan",
    )
    addresses: Mapped[list["ContactAddress"]] = relationship(
        back_populates="contact",
        cascade="all, delete-orphan",
    )


class ContactPhone(IdTimestampMixin, Base):
    __tablename__ = "contact_phones"

    contact_id: Mapped[str] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"))
    value: Mapped[str] = mapped_column(String(128))
    normalized_e164: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    type: Mapped[str] = mapped_column(String(32), default="other")
    label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    source_position: Mapped[int] = mapped_column(Integer, default=0)
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True)

    contact: Mapped[Contact] = relationship(back_populates="phone_numbers")


class ContactEmail(IdTimestampMixin, Base):
    __tablename__ = "contact_emails"

    contact_id: Mapped[str] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"))
    value: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(32), default="other")
    label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    contact: Mapped[Contact] = relationship(back_populates="emails")


class ContactAddress(IdTimestampMixin, Base):
    __tablename__ = "contact_addresses"

    contact_id: Mapped[str] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(32), default="other")
    label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    street: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    region: Mapped[str | None] = mapped_column(String(128), nullable=True)
    country: Mapped[str | None] = mapped_column(String(128), nullable=True)

    contact: Mapped[Contact] = relationship(back_populates="addresses")


from yealink_contacts.models.source import Source  # noqa: E402

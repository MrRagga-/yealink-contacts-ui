from __future__ import annotations

from datetime import UTC, datetime
from threading import Thread

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from yealink_contacts.db.session import SessionLocal
from yealink_contacts.models.contact import Contact, ContactAddress, ContactEmail, ContactPhone
from yealink_contacts.models.job import SyncJob, SyncJobEvent, SyncJobStatus
from yealink_contacts.models.source import Source, SourceMergeStrategy
from yealink_contacts.services.audit import write_audit_log
from yealink_contacts.services.export_service import invalidate_phonebook_cache
from yealink_contacts.services.normalization import normalize_contact_payload
from yealink_contacts.services.source_service import build_adapter, get_credential_payload
from yealink_contacts.services.utils import content_hash


def run_sync(db: Session, source: Source) -> SyncJob:
    job = SyncJob(source_id=source.id, status=SyncJobStatus.running, trigger_type="manual")
    job.started_at = datetime.now(UTC)
    db.add(job)
    db.flush()
    _event(job, "info", f"Sync started for source {source.name}.")
    _run_sync(db, source, job)
    return _reload_job(db, job.id)


def get_active_sync_job(db: Session, source_id: str) -> SyncJob | None:
    return (
        db.execute(
            select(SyncJob)
            .where(
                SyncJob.source_id == source_id,
                SyncJob.status.in_([SyncJobStatus.pending, SyncJobStatus.running]),
            )
            .options(joinedload(SyncJob.events))
            .order_by(SyncJob.created_at.desc())
        )
        .unique()
        .scalar_one_or_none()
    )


def queue_sync(db: Session, source: Source) -> SyncJob:
    existing = get_active_sync_job(db, source.id)
    if existing is not None:
        return existing

    job = SyncJob(source_id=source.id, status=SyncJobStatus.pending, trigger_type="manual")
    db.add(job)
    db.flush()
    _event(job, "info", f"Sync queued for source {source.name}.")
    db.commit()
    queued_job = _reload_job(db, job.id)
    start_sync_job(queued_job.id)
    return queued_job


def start_sync_job(job_id: str) -> None:
    Thread(target=run_queued_sync, args=(job_id,), daemon=True).start()


def run_queued_sync(job_id: str) -> None:
    with SessionLocal() as db:
        job = (
            db.execute(select(SyncJob).where(SyncJob.id == job_id).options(joinedload(SyncJob.events)))
            .unique()
            .scalar_one_or_none()
        )
        if job is None or not job.source_id:
            return

        source = (
            db.execute(select(Source).where(Source.id == job.source_id))
            .unique()
            .scalar_one_or_none()
        )
        if source is None:
            job.status = SyncJobStatus.failed
            job.error_message = "Source not found."
            _event(job, "error", "Sync failed.", {"error": "Source not found."})
            job.finished_at = datetime.now(UTC)
            db.commit()
            return

        job.status = SyncJobStatus.running
        job.started_at = datetime.now(UTC)
        _event(job, "info", f"Sync started for source {source.name}.")
        db.flush()
        _run_sync(db, source, job)


def _run_sync(db: Session, source: Source, job: SyncJob) -> None:
    try:
        adapter = build_adapter(source)
        credential = get_credential_payload(source)
        fetched = adapter.fetch_contacts()
        imported = 0
        fetched_contact_ids: set[str] = set()
        for item in fetched:
            normalized = normalize_contact_payload(item)
            upsert_contact(db, source, normalized)
            imported += 1
            fetched_contact_ids.add(normalized.source_contact_id)

        deleted = 0
        if credential.merge_strategy == SourceMergeStrategy.mirror_source:
            deleted = delete_missing_contacts(db, source, fetched_contact_ids)

        source.last_successful_sync_at = datetime.now(UTC)
        source.last_error = None
        job.status = SyncJobStatus.success
        job.summary = {
            "imported_contacts": imported,
            "deleted_contacts": deleted,
            "merge_strategy": credential.merge_strategy.value,
        }
        if deleted:
            _event(job, "info", f"Synchronized {imported} contact(s) and removed {deleted} local contact(s).")
        else:
            _event(job, "info", f"Successfully synchronized {imported} contact(s).")
        write_audit_log(
            db,
            "source",
            source.id,
            "sync_completed",
            {
                "imported_contacts": imported,
                "deleted_contacts": deleted,
                "merge_strategy": credential.merge_strategy.value,
            },
        )
    except Exception as exc:
        source.last_error = str(exc)
        job.status = SyncJobStatus.failed
        job.error_message = str(exc)
        _event(job, "error", "Sync failed.", {"error": str(exc)})
        write_audit_log(db, "source", source.id, "sync_failed", {"error": str(exc)})
    job.finished_at = datetime.now(UTC)
    db.commit()
    invalidate_phonebook_cache()


def _reload_job(db: Session, job_id: str) -> SyncJob:
    return (
        db.execute(select(SyncJob).where(SyncJob.id == job_id).options(joinedload(SyncJob.events)))
        .unique()
        .scalar_one()
    )


def upsert_contact(db: Session, source: Source, payload) -> Contact:
    existing = db.execute(
        select(Contact)
        .where(Contact.source_id == source.id, Contact.source_contact_id == payload.source_contact_id)
        .options(
            joinedload(Contact.phone_numbers),
            joinedload(Contact.emails),
            joinedload(Contact.addresses),
        )
    ).unique().scalar_one_or_none()

    if existing is None:
        existing = Contact(source_id=source.id, source_contact_id=payload.source_contact_id, content_hash="")
        db.add(existing)

    hash_payload = payload.model_dump(mode="json")
    existing.full_name = payload.full_name or None
    existing.given_name = payload.given_name or None
    existing.family_name = payload.family_name or None
    existing.organization = payload.organization or None
    existing.nickname = payload.nickname or None
    existing.notes = payload.notes
    existing.groups = payload.groups
    existing.photo_url = payload.photo_url
    existing.raw_payload = payload.raw_payload
    existing.content_hash = content_hash(hash_payload)
    existing.last_synced_at = datetime.now(UTC)
    if payload.updated_at:
        existing.updated_at_source = datetime.fromisoformat(payload.updated_at)

    existing.phone_numbers.clear()
    for phone in payload.phone_numbers:
        existing.phone_numbers.append(
            ContactPhone(
                value=phone.value,
                normalized_e164=phone.normalized_e164,
                type=phone.type,
                label=phone.label,
                is_primary=phone.is_primary,
                source_position=phone.source_position,
                is_valid=getattr(phone, "is_valid", bool(phone.normalized_e164)),
            )
        )

    existing.emails.clear()
    for email in payload.emails:
        existing.emails.append(
            ContactEmail(
                value=email.value,
                type=email.type,
                label=email.label,
                is_primary=email.is_primary,
            )
        )

    existing.addresses.clear()
    for address in payload.addresses:
        existing.addresses.append(
            ContactAddress(
                type=address.type,
                label=address.label,
                street=address.street,
                city=address.city,
                postal_code=address.postal_code,
                region=address.region,
                country=address.country,
            )
        )

    db.flush()
    return existing


def delete_missing_contacts(db: Session, source: Source, fetched_contact_ids: set[str]) -> int:
    statement = select(Contact).where(Contact.source_id == source.id)
    if fetched_contact_ids:
        statement = statement.where(Contact.source_contact_id.not_in(fetched_contact_ids))
    contacts_to_delete = db.execute(statement).scalars().all()
    for contact in contacts_to_delete:
        db.delete(contact)
    db.flush()
    return len(contacts_to_delete)


def _event(job: SyncJob, level: str, message: str, details: dict | None = None) -> None:
    job.events.append(SyncJobEvent(level=level, message=message, details=details or {}))

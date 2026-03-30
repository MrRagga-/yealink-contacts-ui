from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from yealink_contacts.models.contact import Contact
from yealink_contacts.models.export_profile import ExportProfile
from yealink_contacts.models.job import SyncJob
from yealink_contacts.models.source import Source
from yealink_contacts.schemas.dashboard import DashboardResponse
from yealink_contacts.services.export_service import build_phonebook_xml, list_export_profiles


def get_dashboard(db: Session) -> DashboardResponse:
    source_count = db.scalar(select(func.count()).select_from(Source)) or 0
    active_source_count = db.scalar(select(func.count()).select_from(Source).where(Source.is_active.is_(True))) or 0
    export_profile_count = db.scalar(select(func.count()).select_from(ExportProfile)) or 0
    contact_count = db.scalar(select(func.count()).select_from(Contact)) or 0
    last_sync_job = db.execute(select(SyncJob).order_by(SyncJob.started_at.desc())).scalar_one_or_none()
    exported_contacts = 0
    xml_endpoints = []
    for profile in list_export_profiles(db):
        xml_endpoints.append(f"/api/yealink/phonebook/{profile.slug}.xml")
        try:
            phonebook = build_phonebook_xml(db, profile.slug)
            exported_contacts += phonebook.xml_body.count("<DirectoryEntry>")
        except Exception:
            continue
    recent_errors = [item.last_error for item in db.execute(select(Source).where(Source.last_error.is_not(None))).scalars()]
    return DashboardResponse(
        source_count=source_count,
        active_source_count=active_source_count,
        export_profile_count=export_profile_count,
        contact_count=contact_count,
        exported_contact_count=exported_contacts,
        last_sync=last_sync_job.started_at.isoformat() if last_sync_job and last_sync_job.started_at else None,
        xml_endpoints=xml_endpoints,
        recent_errors=[error for error in recent_errors if error],
    )

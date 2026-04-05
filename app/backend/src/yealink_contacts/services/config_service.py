from __future__ import annotations

from sqlalchemy.orm import Session

from yealink_contacts.models.export_profile import ExportProfile, RuleSet
from yealink_contacts.schemas.config import AppConfigExport
from yealink_contacts.schemas.settings import AppSettingsUpdate
from yealink_contacts.services.export_service import (
    invalidate_phonebook_cache,
    list_export_profiles,
    normalize_profile_slug,
)
from yealink_contacts.services.settings_service import get_app_settings, update_app_settings
from yealink_contacts.services.source_service import (
    create_source,
    get_credential_payload,
    list_sources,
)


def export_configuration(db: Session) -> AppConfigExport:
    sources = []
    for source in list_sources(db):
        sources.append(
            {
                "name": source.name,
                "slug": source.slug,
                "type": source.type,
                "is_active": source.is_active,
                "notes": source.notes,
                "tags": source.tags,
                "credential": get_credential_payload(source).model_dump(),
                "addressbooks": [
                    {
                        "remote_id": addressbook.remote_id,
                        "href": addressbook.href,
                        "display_name": addressbook.display_name,
                        "description": addressbook.description,
                        "is_selected": addressbook.is_selected,
                        "sync_token": addressbook.sync_token,
                    }
                    for addressbook in source.addressbooks
                ],
            }
        )
    profiles = []
    for profile in list_export_profiles(db):
        rules = profile.rule_set.rules_json if profile.rule_set else {}
        profiles.append(
            {
                "name": profile.name,
                "slug": profile.slug,
                "description": profile.description,
                "is_active": profile.is_active,
                "sort_order": profile.sort_order,
                "metadata": profile.metadata_json,
                "rule_set": rules,
            }
        )
    return AppConfigExport.model_validate(
        {
            "settings": get_app_settings(db),
            "sources": sources,
            "export_profiles": profiles,
        }
    )


def import_configuration(db: Session, payload: AppConfigExport) -> AppConfigExport:
    update_app_settings(db, AppSettingsUpdate(**payload.settings.model_dump()))
    for source in payload.sources:
        create_source(db, source)
    for profile in payload.export_profiles:
        entity = ExportProfile(
            name=profile.name,
            slug=normalize_profile_slug(profile.name, profile.slug),
            description=profile.description,
            is_active=profile.is_active,
            sort_order=profile.sort_order,
            metadata_json=profile.metadata,
        )
        entity.rule_set = RuleSet(rules_json=profile.rule_set.model_dump(mode="json"))
        db.add(entity)
    db.commit()
    invalidate_phonebook_cache()
    return export_configuration(db)

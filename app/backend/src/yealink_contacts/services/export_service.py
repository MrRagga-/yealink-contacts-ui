from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from yealink_contacts.adapters.outputs.yealink.adapter import YealinkOutputAdapter
from yealink_contacts.dedup.service import DuplicateDetector
from yealink_contacts.models.contact import Contact
from yealink_contacts.models.export_profile import ExportProfile, RuleSet
from yealink_contacts.rules.engine import RulesEngine
from yealink_contacts.schemas.export_profile import ExportProfileCreate, ExportProfileUpdate
from yealink_contacts.schemas.contact import ExportPreviewItem, ExportPreviewResponse
from yealink_contacts.schemas.export_profile import ExportProfileResponse
from yealink_contacts.schemas.rules import RuleSetConfig
from yealink_contacts.services.utils import slugify
from yealink_contacts.core.config import get_settings

settings = get_settings()


def list_export_profiles(db: Session) -> list[ExportProfile]:
    return (
        db.execute(select(ExportProfile).options(joinedload(ExportProfile.rule_set)).order_by(ExportProfile.sort_order))
        .unique()
        .scalars()
        .all()
    )


def create_export_profile(db: Session, payload: ExportProfileCreate) -> ExportProfile:
    profile = ExportProfile(
        name=payload.name,
        slug=normalize_profile_slug(payload.name, payload.slug),
        description=payload.description,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
        metadata_json=payload.metadata,
    )
    profile.rule_set = RuleSet(rules_json=payload.rule_set.model_dump(mode="json"))
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return get_export_profile(db, profile.id) or profile


def update_export_profile(
    db: Session,
    profile: ExportProfile,
    payload: ExportProfileUpdate,
) -> ExportProfile:
    if payload.name is not None:
        profile.name = payload.name
    if payload.slug is not None:
        profile.slug = normalize_profile_slug(profile.name, payload.slug)
    if payload.description is not None:
        profile.description = payload.description
    if payload.is_active is not None:
        profile.is_active = payload.is_active
    if payload.sort_order is not None:
        profile.sort_order = payload.sort_order
    if payload.metadata is not None:
        profile.metadata_json = payload.metadata
    if payload.rule_set is not None:
        if profile.rule_set is None:
            profile.rule_set = RuleSet(rules_json=payload.rule_set.model_dump(mode="json"))
        else:
            profile.rule_set.rules_json = payload.rule_set.model_dump(mode="json")
    db.commit()
    db.refresh(profile)
    return get_export_profile(db, profile.id) or profile


def get_export_profile(db: Session, profile_id: str) -> ExportProfile | None:
    return (
        db.execute(
            select(ExportProfile)
            .where(ExportProfile.id == profile_id)
            .options(joinedload(ExportProfile.rule_set))
        )
        .unique()
        .scalar_one_or_none()
    )


def get_export_profile_by_slug(db: Session, slug: str) -> ExportProfile | None:
    return (
        db.execute(
            select(ExportProfile)
            .where(ExportProfile.slug == slug)
            .options(joinedload(ExportProfile.rule_set))
        )
        .unique()
        .scalar_one_or_none()
    )


def serialize_export_profile(profile: ExportProfile) -> ExportProfileResponse:
    rules = RuleSetConfig.model_validate(profile.rule_set.rules_json if profile.rule_set else {})
    return ExportProfileResponse.model_validate(
        {
            **profile.__dict__,
            "metadata": profile.metadata_json,
            "rule_set": rules,
            "xml_url": f"{settings.xml_public_base_url}/api/yealink/phonebook/{profile.slug}.xml",
        }
    )


def generate_preview(db: Session, profile: ExportProfile) -> ExportPreviewResponse:
    rules = RuleSetConfig.model_validate(profile.rule_set.rules_json if profile.rule_set else {})
    contacts = (
        db.execute(
            select(Contact)
            .options(joinedload(Contact.source), joinedload(Contact.phone_numbers), joinedload(Contact.emails))
            .order_by(Contact.full_name)
        )
        .unique()
        .scalars()
        .all()
    )
    duplicate_hints = DuplicateDetector().build_hints(contacts)
    engine = RulesEngine()
    exported: list[ExportPreviewItem] = []
    discarded: list[ExportPreviewItem] = []

    for contact in contacts:
        explanation = engine.explain(contact, rules)
        item = ExportPreviewItem(
            contact_id=contact.id,
            source_id=contact.source_id,
            source_name=contact.source.name,
            original_name=contact.full_name,
            display_name=explanation.display_name,
            selected_numbers=explanation.selected_numbers,
            explanation=explanation,
            duplicate_hints=duplicate_hints.get(contact.id, []),
        )
        if explanation.included:
            exported.append(item)
        else:
            discarded.append(item)

    xml = YealinkOutputAdapter(profile.name, exported).render()
    return ExportPreviewResponse(
        profile_id=profile.id,
        profile_slug=profile.slug,
        exported=exported,
        discarded=discarded,
        generated_xml=xml,
    )


def build_phonebook_xml(db: Session, slug: str) -> tuple[str, str]:
    profile = get_export_profile_by_slug(db, slug)
    if profile is None:
        raise ValueError("Export profile not found.")
    preview = generate_preview(db, profile)
    return preview.generated_xml, "application/xml; charset=utf-8"


def ensure_default_profiles(db: Session) -> None:
    if list_export_profiles(db):
        return
    profile = ExportProfile(
        name="Default",
        slug="default",
        description="Default Yealink phonebook",
        sort_order=0,
    )
    profile.rule_set = RuleSet(
        rules_json=RuleSetConfig().model_dump(mode="json"),
    )
    db.add(profile)
    db.commit()


def normalize_profile_slug(name: str, slug: str | None) -> str:
    return slug or slugify(name)

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from threading import RLock

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
_phonebook_cache_lock = RLock()
_phonebook_cache: dict[str, "CachedPhonebook"] = {}


@dataclass(frozen=True)
class CachedPhonebook:
    xml_body: str
    content_type: str
    etag: str
    cache_hit: bool


def list_export_profiles(db: Session) -> list[ExportProfile]:
    return list(
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
    created = get_export_profile(db, profile.id) or profile
    invalidate_phonebook_cache()
    return created


def update_export_profile(
    db: Session,
    profile: ExportProfile,
    payload: ExportProfileUpdate,
) -> ExportProfile:
    previous_slug = profile.slug
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
    updated = get_export_profile(db, profile.id) or profile
    invalidate_phonebook_cache()
    if previous_slug != updated.slug:
        invalidate_phonebook_cache(previous_slug)
    return updated


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
            "xml_url": f"{resolve_public_xml_base_url()}/api/yealink/phonebook/{profile.slug}.xml",
        }
    )


def generate_preview(
    db: Session,
    profile: ExportProfile,
    *,
    preview_limit: int | None = None,
    include_xml: bool = True,
) -> ExportPreviewResponse:
    rules = RuleSetConfig.model_validate(profile.rule_set.rules_json if profile.rule_set else {})
    contacts = list(
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
    exported_total = 0
    discarded_total = 0
    exported_for_xml: list[ExportPreviewItem] = [] if include_xml else []

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
            exported_total += 1
            if preview_limit is None or len(exported) < preview_limit:
                exported.append(item)
            if include_xml:
                exported_for_xml.append(item)
        else:
            discarded_total += 1
            if preview_limit is None or len(discarded) < preview_limit:
                discarded.append(item)

    xml = YealinkOutputAdapter(profile.name, exported_for_xml).render() if include_xml else None
    return ExportPreviewResponse(
        profile_id=profile.id,
        profile_slug=profile.slug,
        exported_total=exported_total,
        discarded_total=discarded_total,
        preview_limit=preview_limit,
        exported=exported,
        discarded=discarded,
        generated_xml=xml,
    )


def count_exported_contacts(db: Session, profile: ExportProfile) -> int:
    rules = RuleSetConfig.model_validate(profile.rule_set.rules_json if profile.rule_set else {})
    contacts = list(
        db.execute(
            select(Contact)
            .options(joinedload(Contact.source), joinedload(Contact.phone_numbers), joinedload(Contact.emails))
            .order_by(Contact.full_name)
        )
        .unique()
        .scalars()
        .all()
    )
    engine = RulesEngine()
    return sum(1 for contact in contacts if engine.explain(contact, rules).included)


def build_phonebook_xml(db: Session, slug: str) -> CachedPhonebook:
    cached = get_cached_phonebook(slug)
    if cached is not None:
        return cached

    profile = get_export_profile_by_slug(db, slug)
    if profile is None:
        raise ValueError("Export profile not found.")
    preview = generate_preview(db, profile, include_xml=True)
    return store_cached_phonebook(slug, preview.generated_xml or "", "application/xml; charset=utf-8")


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


def resolve_public_xml_base_url() -> str:
    return (settings.xml_public_base_url or settings.frontend_origin).rstrip("/")


def build_phonebook_etag(xml_body: str) -> str:
    return f'"{sha256(xml_body.encode("utf-8")).hexdigest()}"'


def get_cached_phonebook(slug: str) -> CachedPhonebook | None:
    with _phonebook_cache_lock:
        cached = _phonebook_cache.get(slug)
    if cached is None:
        return None
    return CachedPhonebook(
        xml_body=cached.xml_body,
        content_type=cached.content_type,
        etag=cached.etag,
        cache_hit=True,
    )


def store_cached_phonebook(slug: str, xml_body: str, content_type: str) -> CachedPhonebook:
    cached = CachedPhonebook(
        xml_body=xml_body,
        content_type=content_type,
        etag=build_phonebook_etag(xml_body),
        cache_hit=False,
    )
    with _phonebook_cache_lock:
        _phonebook_cache[slug] = cached
    return cached


def invalidate_phonebook_cache(slug: str | None = None) -> None:
    with _phonebook_cache_lock:
        if slug is None:
            _phonebook_cache.clear()
            return
        _phonebook_cache.pop(slug, None)


def warm_phonebook_cache(db: Session, slug: str | None = None) -> None:
    if slug is not None:
        try:
            build_phonebook_xml(db, slug)
        except ValueError:
            pass
        return

    invalidate_phonebook_cache()
    for profile in list_export_profiles(db):
        if profile.is_active:
            build_phonebook_xml(db, profile.slug)

from __future__ import annotations

from datetime import UTC, datetime

from yealink_contacts.db.session import SessionLocal, init_db
from yealink_contacts.models.contact import Contact, ContactPhone
from yealink_contacts.models.export_profile import ExportProfile, RuleSet
from yealink_contacts.models.source import Source, SourceType
from yealink_contacts.schemas.rules import RuleSetConfig


def run() -> None:
    init_db()
    with SessionLocal() as db:
        if db.query(Source).count():
            return

        source = Source(
            name="Demo CardDAV",
            slug="demo-carddav",
            type=SourceType.carddav,
            is_active=True,
            notes="Seed-Quelle für lokale Demo.",
            tags=["demo", "firma"],
        )
        db.add(source)
        db.flush()

        contact = Contact(
            source_id=source.id,
            source_contact_id="demo-1",
            full_name="Ada Lovelace",
            given_name="Ada",
            family_name="Lovelace",
            organization="Analytical Engine GmbH",
            groups=["leadership"],
            raw_payload={"seed": True},
            content_hash="seed-1",
            last_synced_at=datetime.now(UTC),
        )
        contact.phone_numbers.append(
            ContactPhone(
                value="+49 30 1234567",
                normalized_e164="+49301234567",
                type="work",
                label="Büro",
                is_primary=True,
                source_position=0,
                is_valid=True,
            )
        )
        db.add(contact)

        profile = ExportProfile(
            name="Default",
            slug="default",
            description="Seed-Profil",
            is_active=True,
            sort_order=0,
            metadata_json={},
        )
        profile.rule_set = RuleSet(rules_json=RuleSetConfig().model_dump(mode="json"))
        db.add(profile)
        db.commit()


if __name__ == "__main__":
    run()

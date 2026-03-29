from __future__ import annotations

from yealink_contacts.adapters.base import CanonicalContactInput, CanonicalPhoneInput
from yealink_contacts.models.contact import Contact
from yealink_contacts.models.source import SourceMergeStrategy, SourceType
from yealink_contacts.schemas.source import SourceCreate, SourceCredentialPayload
from yealink_contacts.services.source_service import create_source
from yealink_contacts.services.sync_service import run_sync


class DummyAdapter:
    def __init__(self, contacts: list[CanonicalContactInput]) -> None:
        self._contacts = contacts

    def fetch_contacts(self) -> list[CanonicalContactInput]:
        return self._contacts


def test_sync_updates_existing_contacts(db, monkeypatch):
    source = create_source(
        db,
        SourceCreate(
            name="Demo",
            slug="demo",
            type=SourceType.carddav,
            is_active=True,
            tags=[],
            credential=SourceCredentialPayload(merge_strategy=SourceMergeStrategy.upsert_only),
            addressbooks=[],
        ),
    )

    monkeypatch.setattr(
        "yealink_contacts.services.sync_service.build_adapter",
        lambda _: DummyAdapter(
            [
                CanonicalContactInput(
                    source_contact_id="remote-1",
                    full_name="Jonas Weismueller",
                    organization="Example GmbH",
                    phone_numbers=[
                        CanonicalPhoneInput(
                            value="+49 1577 1919442",
                            type="mobile",
                            is_primary=True,
                            source_position=0,
                        )
                    ],
                )
            ]
        ),
    )

    first_job = run_sync(db, source)
    first_contact = db.query(Contact).filter(Contact.source_id == source.id).one()

    monkeypatch.setattr(
        "yealink_contacts.services.sync_service.build_adapter",
        lambda _: DummyAdapter(
            [
                CanonicalContactInput(
                    source_contact_id="remote-1",
                    full_name="Jonas Weismüller",
                    organization="Updated GmbH",
                    phone_numbers=[
                        CanonicalPhoneInput(
                            value="+49 721 27664082",
                            type="work",
                            is_primary=True,
                            source_position=0,
                        )
                    ],
                )
            ]
        ),
    )

    second_job = run_sync(db, source)
    updated_contact = db.query(Contact).filter(Contact.id == first_contact.id).one()

    assert first_job.summary["imported_contacts"] == 1
    assert second_job.summary["imported_contacts"] == 1
    assert updated_contact.full_name == "Jonas Weismüller"
    assert updated_contact.organization == "Updated GmbH"
    assert len(updated_contact.phone_numbers) == 1
    assert updated_contact.phone_numbers[0].type == "work"
    assert updated_contact.phone_numbers[0].value == "+49 721 27664082"


def test_sync_can_mirror_source_and_delete_missing_contacts(db, monkeypatch):
    source = create_source(
        db,
        SourceCreate(
            name="Mirror",
            slug="mirror",
            type=SourceType.carddav,
            is_active=True,
            tags=[],
            credential=SourceCredentialPayload(merge_strategy=SourceMergeStrategy.mirror_source),
            addressbooks=[],
        ),
    )

    monkeypatch.setattr(
        "yealink_contacts.services.sync_service.build_adapter",
        lambda _: DummyAdapter(
            [
                CanonicalContactInput(source_contact_id="remote-1", full_name="Jonas"),
                CanonicalContactInput(source_contact_id="remote-2", full_name="Edith"),
            ]
        ),
    )
    run_sync(db, source)

    monkeypatch.setattr(
        "yealink_contacts.services.sync_service.build_adapter",
        lambda _: DummyAdapter([CanonicalContactInput(source_contact_id="remote-1", full_name="Jonas")]),
    )
    job = run_sync(db, source)
    remaining_contacts = db.query(Contact).filter(Contact.source_id == source.id).all()

    assert job.summary["imported_contacts"] == 1
    assert job.summary["deleted_contacts"] == 1
    assert len(remaining_contacts) == 1
    assert remaining_contacts[0].source_contact_id == "remote-1"

from __future__ import annotations

from collections.abc import Sequence
from collections import defaultdict
from difflib import SequenceMatcher

from yealink_contacts.models.contact import Contact
from yealink_contacts.schemas.contact import DuplicateHint


class DuplicateDetector:
    def build_hints(self, contacts: Sequence[Contact]) -> dict[str, list[DuplicateHint]]:
        hints: dict[str, list[DuplicateHint]] = defaultdict(list)
        self._detect_by_phone(contacts, hints)
        self._detect_by_email(contacts, hints)
        self._detect_by_similarity(contacts, hints)
        return hints

    def _detect_by_phone(self, contacts: Sequence[Contact], hints: dict[str, list[DuplicateHint]]) -> None:
        phone_map: dict[str, list[str]] = defaultdict(list)
        for contact in contacts:
            for phone in contact.phone_numbers:
                if phone.normalized_e164:
                    phone_map[phone.normalized_e164].append(contact.id)
        for value, contact_ids in phone_map.items():
            if len(contact_ids) > 1:
                for contact_id in contact_ids:
                    hints[contact_id].append(
                        DuplicateHint(
                            kind="phone",
                            value=value,
                            related_contact_ids=[item for item in contact_ids if item != contact_id],
                            score=1.0,
                        )
                    )

    def _detect_by_email(self, contacts: Sequence[Contact], hints: dict[str, list[DuplicateHint]]) -> None:
        email_map: dict[str, list[str]] = defaultdict(list)
        for contact in contacts:
            for email in contact.emails:
                email_map[email.value.lower()].append(contact.id)
        for value, contact_ids in email_map.items():
            if len(contact_ids) > 1:
                for contact_id in contact_ids:
                    hints[contact_id].append(
                        DuplicateHint(
                            kind="email",
                            value=value,
                            related_contact_ids=[item for item in contact_ids if item != contact_id],
                            score=1.0,
                        )
                    )

    def _detect_by_similarity(self, contacts: Sequence[Contact], hints: dict[str, list[DuplicateHint]]) -> None:
        for index, left in enumerate(contacts):
            for right in contacts[index + 1 :]:
                if not left.full_name or not right.full_name:
                    continue
                if left.organization != right.organization:
                    continue
                score = SequenceMatcher(None, left.full_name.lower(), right.full_name.lower()).ratio()
                if score >= 0.86:
                    hints[left.id].append(
                        DuplicateHint(
                            kind="similarity",
                            value=right.full_name,
                            related_contact_ids=[right.id],
                            score=round(score, 2),
                        )
                    )
                    hints[right.id].append(
                        DuplicateHint(
                            kind="similarity",
                            value=left.full_name,
                            related_contact_ids=[left.id],
                            score=round(score, 2),
                        )
                    )

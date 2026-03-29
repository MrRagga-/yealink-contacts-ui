from __future__ import annotations

from collections.abc import Iterable

from yealink_contacts.models.contact import Contact, ContactPhone
from yealink_contacts.rules.search_query import SearchQueryParser
from yealink_contacts.schemas.rules import RuleExplanation, RuleSetConfig, SelectedPhone
from yealink_contacts.services.utils import collapse_whitespace
from yealink_contacts.rules.template import render_name_expression


class RulesEngine:
    def __init__(self) -> None:
        self.search_query_parser = SearchQueryParser()

    def apply(self, contact: Contact, context: RuleSetConfig) -> RuleExplanation:
        explanation = RuleExplanation(included=True, reasons=[])
        filters = context.filters
        phone_rules = context.phone_selection

        if filters.include_source_ids and contact.source_id not in filters.include_source_ids:
            explanation.included = False
            explanation.reasons.append("Source is not included in this export profile.")

        if contact.source_id in filters.exclude_source_ids:
            explanation.included = False
            explanation.reasons.append("Source was explicitly excluded.")

        if filters.include_groups and not set(filters.include_groups).intersection(set(contact.groups)):
            explanation.included = False
            explanation.reasons.append("Contact does not match any selected group.")

        if filters.search_query:
            haystack = self._build_search_haystack(contact)
            if not self._matches_search_query(haystack, filters.search_query):
                explanation.included = False
                explanation.reasons.append("Contact does not match the search filter.")

        if contact.id in filters.blacklist_contact_ids:
            explanation.included = False
            explanation.reasons.append("Contact is on the ignore list.")

        selected_phones, discarded_numbers = self._select_phones(contact.phone_numbers, context)
        explanation.discarded_numbers = discarded_numbers

        if phone_rules.require_phone and not selected_phones:
            explanation.included = False
            explanation.reasons.append("No exportable phone number found.")

        if any(number.value in filters.blacklist_numbers for number in selected_phones):
            explanation.included = False
            explanation.reasons.append("The selected number is blacklisted.")

        display_name = render_name_expression(context.name_template.expression, contact, selected_phones)
        display_name = f"{context.name_template.prefix}{display_name}{context.name_template.suffix}"
        if context.name_template.normalize_whitespace:
            display_name = collapse_whitespace(display_name)

        if not display_name and selected_phones:
            display_name = selected_phones[0].value
            explanation.reasons.append("Falling back to the primary phone number for the display name.")

        explanation.display_name = display_name or None
        explanation.selected_numbers = [
            SelectedPhone(
                value=phone.value,
                normalized_e164=phone.normalized_e164,
                type=phone.type,
                label=phone.label,
                source_position=phone.source_position,
            )
            for phone in selected_phones
        ]
        if explanation.included and selected_phones:
            explanation.reasons.append(f"Selected {len(selected_phones)} number(s) for export.")
        return explanation

    def explain(self, contact: Contact, context: RuleSetConfig) -> RuleExplanation:
        return self.apply(contact, context)

    def _select_phones(
        self,
        phones: Iterable[ContactPhone],
        context: RuleSetConfig,
    ) -> tuple[list[ContactPhone], list[str]]:
        phone_rules = context.phone_selection
        discarded: list[str] = []
        allowed = set(phone_rules.allowed_types)
        excluded = set(phone_rules.excluded_types)
        priority_index = {phone_type: index for index, phone_type in enumerate(phone_rules.priority_order)}

        filtered = []
        for phone in phones:
            if not phone.value:
                discarded.append("Discarded an empty number.")
                continue
            if phone.type in excluded:
                discarded.append(f"{phone.value} excluded because type {phone.type} is excluded.")
                continue
            if allowed and phone.type not in allowed:
                discarded.append(f"{phone.value} discarded because type {phone.type} is not allowed.")
                continue
            filtered.append(phone)

        filtered.sort(
            key=lambda item: (
                priority_index.get(item.type, len(priority_index) + 1),
                0 if item.is_primary else 1,
                item.source_position,
            )
        )
        max_items = max(phone_rules.max_numbers_per_contact, 1)
        return filtered[:max_items], discarded

    def _build_search_haystack(self, contact: Contact) -> str:
        return " ".join(
            filter(
                None,
                [
                    contact.full_name,
                    contact.given_name,
                    contact.family_name,
                    contact.organization,
                    contact.notes,
                ],
            )
        ).lower()

    def _matches_search_query(self, haystack: str, query: str) -> bool:
        expression = self.search_query_parser.parse(query)
        if expression is None:
            return True
        return expression.evaluate(haystack)

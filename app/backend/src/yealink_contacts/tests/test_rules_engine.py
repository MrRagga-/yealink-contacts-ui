from __future__ import annotations

from yealink_contacts.models.contact import Contact, ContactPhone
from yealink_contacts.rules.engine import RulesEngine
from yealink_contacts.schemas.rules import RuleSetConfig


def test_rules_engine_prioritizes_mobile_and_limits_to_one():
    contact = Contact(
        id="contact-1",
        source_id="source-a",
        source_contact_id="external-1",
        full_name="Ada Lovelace",
        content_hash="hash",
        raw_payload={},
        groups=["team"],
    )
    contact.phone_numbers = [
        ContactPhone(value="030 222", normalized_e164="+4930222", type="work", source_position=1, is_valid=True),
        ContactPhone(value="0171 111", normalized_e164="+49171111", type="mobile", source_position=0, is_valid=True),
    ]

    config = RuleSetConfig.model_validate(
        {
            "filters": {"include_source_ids": ["source-a"], "include_groups": ["team"], "blacklist_contact_ids": [], "blacklist_numbers": []},
            "phone_selection": {
                "allowed_types": ["mobile", "work"],
                "excluded_types": ["fax"],
                "priority_order": ["mobile", "work"],
                "require_phone": True,
                "max_numbers_per_contact": 1,
                "normalize_to_e164": True,
            },
            "name_template": {"expression": "{full_name}", "prefix": "", "suffix": "", "normalize_whitespace": True},
        }
    )

    explanation = RulesEngine().apply(contact, config)

    assert explanation.included is True
    assert explanation.selected_numbers[0].type == "mobile"
    assert explanation.display_name == "Ada Lovelace"


def test_rules_engine_search_query_supports_or_and_not():
    contact = Contact(
        id="contact-2",
        source_id="source-a",
        source_contact_id="external-2",
        full_name="Ada Lovelace",
        organization="Analytical Engine",
        notes="Team Mathematik",
        content_hash="hash",
        raw_payload={},
        groups=["team"],
    )
    contact.phone_numbers = [
        ContactPhone(value="0171 111", normalized_e164="+49171111", type="mobile", source_position=0, is_valid=True),
    ]

    engine = RulesEngine()

    or_config = RuleSetConfig.model_validate(
        {
            "filters": {"search_query": "vertrieb, mathematik", "blacklist_contact_ids": [], "blacklist_numbers": []},
            "phone_selection": {
                "allowed_types": ["mobile"],
                "excluded_types": ["fax"],
                "priority_order": ["mobile"],
                "require_phone": True,
                "max_numbers_per_contact": 1,
                "normalize_to_e164": True,
            },
            "name_template": {"expression": "{full_name}", "prefix": "", "suffix": "", "normalize_whitespace": True},
        }
    )
    assert engine.apply(contact, or_config).included is True

    and_not_config = RuleSetConfig.model_validate(
        {
            "filters": {"search_query": "ada AND engine NOT vertrieb", "blacklist_contact_ids": [], "blacklist_numbers": []},
            "phone_selection": {
                "allowed_types": ["mobile"],
                "excluded_types": ["fax"],
                "priority_order": ["mobile"],
                "require_phone": True,
                "max_numbers_per_contact": 1,
                "normalize_to_e164": True,
            },
            "name_template": {"expression": "{full_name}", "prefix": "", "suffix": "", "normalize_whitespace": True},
        }
    )
    assert engine.apply(contact, and_not_config).included is True

    failing_config = RuleSetConfig.model_validate(
        {
            "filters": {"search_query": "ada AND vertrieb", "blacklist_contact_ids": [], "blacklist_numbers": []},
            "phone_selection": {
                "allowed_types": ["mobile"],
                "excluded_types": ["fax"],
                "priority_order": ["mobile"],
                "require_phone": True,
                "max_numbers_per_contact": 1,
                "normalize_to_e164": True,
            },
            "name_template": {"expression": "{full_name}", "prefix": "", "suffix": "", "normalize_whitespace": True},
        }
    )
    assert engine.apply(contact, failing_config).included is False


def test_rules_engine_search_query_supports_parentheses_and_documents_and_behavior():
    jonas = Contact(
        id="contact-3",
        source_id="source-a",
        source_contact_id="external-3",
        full_name="Jonas Weismüller",
        content_hash="hash",
        raw_payload={},
        groups=["family"],
    )
    jonas.phone_numbers = [
        ContactPhone(value="0171 111", normalized_e164="+49171111", type="mobile", source_position=0, is_valid=True),
    ]

    engine = RulesEngine()
    base_phone_selection = {
        "allowed_types": ["mobile"],
        "excluded_types": ["fax"],
        "priority_order": ["mobile"],
        "require_phone": True,
        "max_numbers_per_contact": 1,
        "normalize_to_e164": True,
    }
    name_template = {"expression": "{full_name}", "prefix": "", "suffix": "", "normalize_whitespace": True}

    explicit_grouping = RuleSetConfig.model_validate(
        {
            "filters": {
                "search_query": "Weismüller AND NOT (Edith OR Paul)",
                "blacklist_contact_ids": [],
                "blacklist_numbers": [],
            },
            "phone_selection": base_phone_selection,
            "name_template": name_template,
        }
    )
    assert engine.apply(jonas, explicit_grouping).included is True

    narrowing_query = RuleSetConfig.model_validate(
        {
            "filters": {
                "search_query": "Weismüller NOT Edith NOT Paul AND Bärbel",
                "blacklist_contact_ids": [],
                "blacklist_numbers": [],
            },
            "phone_selection": base_phone_selection,
            "name_template": name_template,
        }
    )
    assert engine.apply(jonas, narrowing_query).included is False

from __future__ import annotations

from yealink_contacts.adapters.outputs.yealink.adapter import YealinkOutputAdapter
from yealink_contacts.schemas.contact import ExportPreviewItem
from yealink_contacts.schemas.rules import RuleExplanation, SelectedPhone


def test_yealink_output_renders_directory_entries():
    item = ExportPreviewItem(
        contact_id="contact-1",
        source_id="source-1",
        source_name="Demo",
        original_name="Ada Lovelace",
        display_name="Ada Lovelace",
        selected_numbers=[SelectedPhone(value="+49 30 123", normalized_e164="+4930123", type="work", source_position=0)],
        explanation=RuleExplanation(included=True, display_name="Ada Lovelace", reasons=["ok"]),
        duplicate_hints=[],
    )

    xml = YealinkOutputAdapter("Default", [item]).render()

    assert "<YealinkIPPhoneDirectory>" in xml
    assert "<Name>Ada Lovelace</Name>" in xml
    assert "<Telephone>+4930123</Telephone>" in xml

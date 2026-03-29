from __future__ import annotations

from xml.etree.ElementTree import Element, SubElement, tostring

from yealink_contacts.adapters.base import OutputAdapter
from yealink_contacts.schemas.contact import ExportPreviewItem


class YealinkOutputAdapter(OutputAdapter):
    def __init__(self, title: str, items: list[ExportPreviewItem]) -> None:
        self.title = title
        self.items = items

    def preview(self) -> str:
        return self.render()

    def render(self) -> str:
        root = Element("YealinkIPPhoneDirectory")
        title = SubElement(root, "Title")
        title.text = self.title
        prompt = SubElement(root, "Prompt")
        prompt.text = "Yealink Contacts Sync"

        for item in sorted(self.items, key=lambda entry: ((entry.display_name or "").lower(), entry.contact_id)):
            directory_entry = SubElement(root, "DirectoryEntry")
            name = SubElement(directory_entry, "Name")
            name.text = item.display_name or item.original_name or "Unbenannt"
            for phone in item.selected_numbers:
                telephone = SubElement(directory_entry, "Telephone")
                telephone.text = phone.normalized_e164 or phone.value

        xml_body = tostring(root, encoding="utf-8", xml_declaration=True)
        return xml_body.decode("utf-8")

    def content_type(self) -> str:
        return "application/xml; charset=utf-8"

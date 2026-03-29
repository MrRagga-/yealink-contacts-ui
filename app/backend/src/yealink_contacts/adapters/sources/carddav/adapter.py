from __future__ import annotations

from dataclasses import dataclass
from xml.etree import ElementTree

import httpx
import vobject

from yealink_contacts.adapters.base import (
    AddressbookInfo,
    CanonicalAddressInput,
    CanonicalContactInput,
    CanonicalEmailInput,
    CanonicalPhoneInput,
    SourceAdapter,
)
from yealink_contacts.core.config import get_settings

DAV_NS = {
    "d": "DAV:",
    "card": "urn:ietf:params:xml:ns:carddav",
}


@dataclass
class CardDAVConfig:
    server_url: str
    username: str
    password: str
    selected_addressbooks: list[str]


class CardDAVAdapter(SourceAdapter):
    def __init__(self, config: CardDAVConfig) -> None:
        self.config = config
        self.settings = get_settings()

    def test_connection(self) -> tuple[bool, str]:
        try:
            addressbooks = self.list_addressbooks()
        except httpx.HTTPError as exc:
            return False, f"CardDAV connection failed: {exc}"
        return True, f"Discovered {len(addressbooks)} addressbook(s)."

    def list_addressbooks(self) -> list[AddressbookInfo]:
        with self._client() as client:
            home_url = self._discover_home_url(client)
            addressbooks = self._propfind_addressbooks(client, home_url)
            if not addressbooks:
                addressbooks = [
                    AddressbookInfo(
                        remote_id=home_url.rstrip("/").split("/")[-1],
                        href=home_url,
                        display_name=home_url.rstrip("/").split("/")[-1] or "Addressbook",
                    )
                ]
            return addressbooks

    def fetch_contacts(self) -> list[CanonicalContactInput]:
        contacts: list[CanonicalContactInput] = []
        hrefs = self.config.selected_addressbooks or [book.href for book in self.list_addressbooks()]
        with self._client() as client:
            for href in hrefs:
                response = client.request(
                    "REPORT",
                    href,
                    headers={
                        "Depth": "1",
                        "Content-Type": "application/xml; charset=utf-8",
                    },
                    content="""
                        <card:addressbook-query xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
                          <d:prop>
                            <d:getetag />
                            <card:address-data />
                          </d:prop>
                        </card:addressbook-query>
                    """.strip(),
                )
                response.raise_for_status()
                contacts.extend(self._parse_carddav_report(response.text))
        return contacts

    def fetch_contact_by_id(self, contact_id: str) -> CanonicalContactInput | None:
        for contact in self.fetch_contacts():
            if contact.source_contact_id == contact_id:
                return contact
        return None

    def get_capabilities(self) -> dict:
        return {
            "supports_addressbooks": True,
            "supports_delta_sync": False,
            "supports_test_connection": True,
        }

    def _client(self) -> httpx.Client:
        return httpx.Client(
            auth=(self.config.username, self.config.password),
            timeout=self.settings.sync_http_timeout,
            follow_redirects=True,
        )

    def _discover_home_url(self, client: httpx.Client) -> str:
        discovery_body = """
            <d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
              <d:prop>
                <d:current-user-principal />
                <card:addressbook-home-set />
              </d:prop>
            </d:propfind>
        """.strip()
        response = client.request(
            "PROPFIND",
            self.config.server_url,
            headers={"Depth": "0", "Content-Type": "application/xml; charset=utf-8"},
            content=discovery_body,
        )
        response.raise_for_status()
        root = ElementTree.fromstring(response.text)
        addressbook_home = root.find(".//card:addressbook-home-set/d:href", DAV_NS)
        if addressbook_home is not None and addressbook_home.text:
            return httpx.URL(self.config.server_url).join(addressbook_home.text).__str__()
        return self.config.server_url

    def _propfind_addressbooks(self, client: httpx.Client, home_url: str) -> list[AddressbookInfo]:
        response = client.request(
            "PROPFIND",
            home_url,
            headers={"Depth": "1", "Content-Type": "application/xml; charset=utf-8"},
            content="""
                <d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
                  <d:prop>
                    <d:displayname />
                    <d:resourcetype />
                    <card:supported-address-data />
                  </d:prop>
                </d:propfind>
            """.strip(),
        )
        response.raise_for_status()
        root = ElementTree.fromstring(response.text)
        books: list[AddressbookInfo] = []
        for item in root.findall("d:response", DAV_NS):
            href = item.findtext("d:href", default="", namespaces=DAV_NS)
            resource_type = item.find(".//d:resourcetype/card:addressbook", DAV_NS)
            if resource_type is None:
                continue
            display_name = item.findtext(".//d:displayname", default=href, namespaces=DAV_NS)
            absolute_href = httpx.URL(home_url).join(href).__str__()
            books.append(
                AddressbookInfo(
                    remote_id=absolute_href.rstrip("/").split("/")[-1],
                    href=absolute_href,
                    display_name=display_name or absolute_href.rstrip("/").split("/")[-1],
                )
            )
        return books

    def _parse_carddav_report(self, xml_body: str) -> list[CanonicalContactInput]:
        root = ElementTree.fromstring(xml_body)
        contacts: list[CanonicalContactInput] = []
        for response in root.findall("d:response", DAV_NS):
            href = response.findtext("d:href", default="", namespaces=DAV_NS)
            address_data = response.findtext(".//card:address-data", default="", namespaces=DAV_NS)
            if not address_data:
                continue
            try:
                card = vobject.readOne(address_data)
            except Exception:
                continue
            contacts.append(self._map_vcard(href, card, address_data))
        return contacts

    def _map_vcard(self, href: str, card: vobject.base.Component, raw_payload: str) -> CanonicalContactInput:
        name_value = getattr(getattr(card, "fn", None), "value", None)
        name = getattr(getattr(card, "n", None), "value", None)
        given_name = getattr(name, "given", "") if name else ""
        family_name = getattr(name, "family", "") if name else ""
        organization = None
        if hasattr(card, "org"):
            org_value = getattr(card.org, "value", None)
            if isinstance(org_value, list):
                organization = " ".join(str(part) for part in org_value if part)
            else:
                organization = str(org_value or "")

        phones: list[CanonicalPhoneInput] = []
        for index, phone in enumerate(card.contents.get("tel", [])):
            type_param = phone.params.get("TYPE", ["other"])
            phones.append(
                CanonicalPhoneInput(
                    value=str(phone.value),
                    type=str(type_param[0]).lower(),
                    label=",".join(type_param),
                    is_primary=index == 0,
                    source_position=index,
                )
            )

        emails = [
            CanonicalEmailInput(
                value=str(email.value),
                type=str(email.params.get("TYPE", ["other"])[0]).lower(),
                label=",".join(email.params.get("TYPE", [])) or None,
                is_primary=index == 0,
            )
            for index, email in enumerate(card.contents.get("email", []))
        ]

        addresses = []
        for address in card.contents.get("adr", []):
            value = address.value
            addresses.append(
                CanonicalAddressInput(
                    type=str(address.params.get("TYPE", ["other"])[0]).lower(),
                    label=",".join(address.params.get("TYPE", [])) or None,
                    street=" ".join(filter(None, [value.street, value.extended])),
                    city=value.city,
                    postal_code=value.code,
                    region=value.region,
                    country=value.country,
                )
            )

        groups = [item.value for item in card.contents.get("categories", []) if getattr(item, "value", None)]
        return CanonicalContactInput(
            source_contact_id=href.rstrip("/").split("/")[-1] or href,
            full_name=name_value,
            given_name=given_name,
            family_name=family_name,
            organization=organization,
            nickname=getattr(getattr(card, "nickname", None), "value", None),
            notes=getattr(getattr(card, "note", None), "value", None),
            emails=emails,
            phone_numbers=phones,
            addresses=addresses,
            groups=groups,
            photo_url=None,
            raw_payload={"vcard": raw_payload},
        )

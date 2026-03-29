from __future__ import annotations

from dataclasses import dataclass

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from yealink_contacts.adapters.base import (
    AddressbookInfo,
    CanonicalAddressInput,
    CanonicalContactInput,
    CanonicalEmailInput,
    CanonicalPhoneInput,
    SourceAdapter,
)
PEOPLE_FIELDS = ",".join(
    [
        "names",
        "nicknames",
        "organizations",
        "phoneNumbers",
        "emailAddresses",
        "biographies",
        "addresses",
        "memberships",
        "photos",
        "metadata",
    ]
)


@dataclass
class GoogleAdapterConfig:
    client_id: str
    client_secret: str
    refresh_token: str
    redirect_uri: str | None = None
    auth_uri: str | None = None
    token_uri: str | None = None
    access_token: str | None = None
    account_email: str | None = None


class GoogleContactsAdapter(SourceAdapter):
    def __init__(self, config: GoogleAdapterConfig) -> None:
        self.config = config

    def test_connection(self) -> tuple[bool, str]:
        if not self.config.client_id or not self.config.client_secret:
            return False, "Google OAuth is not configured."
        try:
            service = self._service()
            response = (
                service.people()
                .connections()
                .list(resourceName="people/me", pageSize=1, personFields=PEOPLE_FIELDS)
                .execute()
            )
        except Exception as exc:
            return False, f"Google connection failed: {exc}"
        return True, f"Loaded {len(response.get('connections', []))} contact sample(s)."

    def list_addressbooks(self) -> list[AddressbookInfo]:
        return [
            AddressbookInfo(
                remote_id="google-contacts",
                href="people/me",
                display_name="Google Contacts",
                description=self.config.account_email,
            )
        ]

    def fetch_contacts(self) -> list[CanonicalContactInput]:
        service = self._service()
        contacts: list[CanonicalContactInput] = []
        page_token: str | None = None
        while True:
            response = (
                service.people()
                .connections()
                .list(
                    resourceName="people/me",
                    pageToken=page_token,
                    pageSize=500,
                    sortOrder="LAST_MODIFIED_DESCENDING",
                    personFields=PEOPLE_FIELDS,
                )
                .execute()
            )
            contacts.extend(self._map_person(person) for person in response.get("connections", []))
            page_token = response.get("nextPageToken")
            if not page_token:
                break
        return contacts

    def fetch_contact_by_id(self, contact_id: str) -> CanonicalContactInput | None:
        service = self._service()
        try:
            person = service.people().get(resourceName=contact_id, personFields=PEOPLE_FIELDS).execute()
        except Exception:
            return None
        return self._map_person(person)

    def get_capabilities(self) -> dict:
        return {
            "supports_addressbooks": False,
            "supports_delta_sync": True,
            "supports_test_connection": True,
        }

    def _service(self):
        credentials = Credentials(
            token=self.config.access_token,
            refresh_token=self.config.refresh_token,
            token_uri=self.config.token_uri or "https://oauth2.googleapis.com/token",
            client_id=self.config.client_id,
            client_secret=self.config.client_secret,
            scopes=["https://www.googleapis.com/auth/contacts.readonly"],
        )
        return build("people", "v1", credentials=credentials, cache_discovery=False)

    def _map_person(self, person: dict) -> CanonicalContactInput:
        names = person.get("names", [])
        primary_name = names[0] if names else {}
        organizations = person.get("organizations", [])
        primary_organization = organizations[0] if organizations else {}
        phones = [
            CanonicalPhoneInput(
                value=item.get("value", ""),
                normalized_e164=item.get("canonicalForm"),
                type=(item.get("type") or "other").lower(),
                label=item.get("formattedType"),
                is_primary=item.get("metadata", {}).get("primary", False),
                source_position=index,
            )
            for index, item in enumerate(person.get("phoneNumbers", []))
        ]
        emails = [
            CanonicalEmailInput(
                value=item.get("value", ""),
                type=(item.get("type") or "other").lower(),
                label=item.get("formattedType"),
                is_primary=item.get("metadata", {}).get("primary", False),
            )
            for item in person.get("emailAddresses", [])
        ]
        addresses = [
            CanonicalAddressInput(
                type=(item.get("type") or "other").lower(),
                label=item.get("formattedType"),
                street=item.get("streetAddress"),
                city=item.get("city"),
                postal_code=item.get("postalCode"),
                region=item.get("region"),
                country=item.get("country"),
            )
            for item in person.get("addresses", [])
        ]
        groups = []
        for membership in person.get("memberships", []):
            group = membership.get("contactGroupMembership", {})
            if group.get("contactGroupResourceName"):
                groups.append(group["contactGroupResourceName"])
        biographies = person.get("biographies", [])
        photos = person.get("photos", [])
        metadata = person.get("metadata", {})
        return CanonicalContactInput(
            source_contact_id=person.get("resourceName", ""),
            full_name=primary_name.get("displayName"),
            given_name=primary_name.get("givenName"),
            family_name=primary_name.get("familyName"),
            organization=primary_organization.get("name"),
            nickname=(person.get("nicknames", [{}])[0] or {}).get("value"),
            notes=(biographies[0] or {}).get("value") if biographies else None,
            emails=emails,
            phone_numbers=phones,
            addresses=addresses,
            groups=groups,
            photo_url=(photos[0] or {}).get("url") if photos else None,
            raw_payload=person,
            updated_at=metadata.get("sources", [{}])[0].get("updateTime"),
        )

from __future__ import annotations

GOOGLE_CONTACTS_READONLY_SCOPE = "https://www.googleapis.com/auth/contacts.readonly"
GOOGLE_OAUTH_SCOPES = [GOOGLE_CONTACTS_READONLY_SCOPE]


def validate_google_contact_scopes(granted_scopes: list[str] | None) -> None:
    if not granted_scopes or GOOGLE_CONTACTS_READONLY_SCOPE not in granted_scopes:
        raise ValueError(
            "Google did not grant contacts read access. Revoke this app under your Google "
            "account security settings, then run Google OAuth again."
        )


def resolve_google_oauth_scopes(granted_scopes: list[str] | None) -> list[str]:
    validate_google_contact_scopes(granted_scopes)
    return list(granted_scopes or GOOGLE_OAUTH_SCOPES)

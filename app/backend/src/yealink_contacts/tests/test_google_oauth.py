from __future__ import annotations

import pytest

from yealink_contacts.adapters.sources.google.oauth import (
    GOOGLE_CONTACTS_READONLY_SCOPE,
    resolve_google_oauth_scopes,
    validate_google_contact_scopes,
)


def test_validate_google_contact_scopes_accepts_contacts_readonly():
    validate_google_contact_scopes([GOOGLE_CONTACTS_READONLY_SCOPE, "openid"])


def test_validate_google_contact_scopes_rejects_missing_contacts_scope():
    with pytest.raises(ValueError, match="contacts read access"):
        validate_google_contact_scopes(["openid", "email"])


def test_resolve_google_oauth_scopes_returns_granted_scopes():
    granted = [GOOGLE_CONTACTS_READONLY_SCOPE, "openid"]

    assert resolve_google_oauth_scopes(granted) == granted

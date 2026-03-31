from __future__ import annotations

import json
import secrets
from datetime import UTC, datetime
from typing import Any, cast
from urllib.parse import urlparse

from fastapi import HTTPException, Request, status
from pwdlib import PasswordHash
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (
    AuthenticatorTransport,
    PublicKeyCredentialDescriptor,
    UserVerificationRequirement,
)

from yealink_contacts.core.config import get_settings
from yealink_contacts.models.auth import AdminUser, PasskeyCredential
from yealink_contacts.schemas.auth import AuthenticatedAdminResponse
from yealink_contacts.services.audit import write_audit_log

SESSION_USER_ID_KEY = "admin_user_id"
SESSION_REGISTRATION_KEY = "passkey_registration"
SESSION_AUTHENTICATION_KEY = "passkey_authentication"

password_hash = PasswordHash.recommended()


def build_auth_response(db: Session, admin_user: AdminUser) -> AuthenticatedAdminResponse:
    passkey_count = db.scalar(
        select(func.count(PasskeyCredential.id)).where(PasskeyCredential.admin_user_id == admin_user.id)
    )
    return AuthenticatedAdminResponse(
        id=admin_user.id,
        username=admin_user.username,
        must_change_password=admin_user.must_change_password,
        is_active=admin_user.is_active,
        passkey_count=passkey_count or 0,
    )


def seed_bootstrap_admin(db: Session) -> None:
    existing = db.scalar(select(func.count(AdminUser.id)))
    if existing:
        return

    db.add(
        AdminUser(
            username="admin",
            password_hash=password_hash.hash("admin"),
            must_change_password=True,
            is_active=True,
        )
    )
    db.commit()


def get_admin_user_by_id(db: Session, admin_user_id: str) -> AdminUser | None:
    return db.execute(
        select(AdminUser)
        .options(selectinload(AdminUser.passkeys))
        .where(AdminUser.id == admin_user_id, AdminUser.is_active.is_(True))
    ).scalar_one_or_none()


def get_admin_user_by_username(db: Session, username: str) -> AdminUser | None:
    return db.execute(
        select(AdminUser)
        .options(selectinload(AdminUser.passkeys))
        .where(AdminUser.username == username, AdminUser.is_active.is_(True))
    ).scalar_one_or_none()


def get_current_admin_user_from_session(request: Request, db: Session) -> AdminUser:
    admin_user_id = request.session.get(SESSION_USER_ID_KEY)
    if not isinstance(admin_user_id, str):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    admin_user = get_admin_user_by_id(db, admin_user_id)
    if admin_user is None:
        request.session.clear()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    return admin_user


def login_with_password(db: Session, username: str, password: str) -> AdminUser:
    admin_user = get_admin_user_by_username(db, username)
    if admin_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password.")

    valid, updated_hash = password_hash.verify_and_update(password, admin_user.password_hash)
    if not valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password.")

    if updated_hash is not None:
        admin_user.password_hash = updated_hash

    admin_user.last_login_at = datetime.now(UTC)
    db.commit()
    db.refresh(admin_user)
    return admin_user


def persist_session_login(request: Request, admin_user: AdminUser) -> None:
    request.session.clear()
    request.session[SESSION_USER_ID_KEY] = admin_user.id


def logout_session(request: Request) -> None:
    request.session.clear()


def change_password(db: Session, admin_user: AdminUser, current_password: str, new_password: str) -> AdminUser:
    valid, updated_hash = password_hash.verify_and_update(current_password, admin_user.password_hash)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    if current_password == new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a different password.")

    admin_user.password_hash = updated_hash or password_hash.hash(new_password)
    admin_user.must_change_password = False
    write_audit_log(
        db,
        "admin_user",
        admin_user.id,
        "password_changed",
        {"username": admin_user.username},
    )
    db.commit()
    db.refresh(admin_user)
    return admin_user


def list_passkeys(db: Session, admin_user: AdminUser) -> list[PasskeyCredential]:
    return list(
        db.execute(
        select(PasskeyCredential)
        .where(PasskeyCredential.admin_user_id == admin_user.id)
        .order_by(PasskeyCredential.created_at.asc())
        ).scalars().all()
    )


def get_passkey_or_404(db: Session, admin_user: AdminUser, passkey_id: str) -> PasskeyCredential:
    passkey = db.execute(
        select(PasskeyCredential).where(
            PasskeyCredential.id == passkey_id,
            PasskeyCredential.admin_user_id == admin_user.id,
        )
    ).scalar_one_or_none()
    if passkey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passkey not found.")
    return passkey


def delete_passkey(db: Session, admin_user: AdminUser, passkey_id: str) -> None:
    passkey = get_passkey_or_404(db, admin_user, passkey_id)
    db.delete(passkey)
    write_audit_log(
        db,
        "admin_user",
        admin_user.id,
        "passkey_deleted",
        {"passkey_id": passkey.id, "label": passkey.label},
    )
    db.commit()


def get_rp_name() -> str:
    settings = get_settings()
    return settings.webauthn_rp_name or settings.app_name


def get_rp_origin() -> str:
    settings = get_settings()
    return settings.webauthn_rp_origin or settings.frontend_origin


def get_rp_id() -> str:
    settings = get_settings()
    if settings.webauthn_rp_id:
        return settings.webauthn_rp_id
    hostname = urlparse(get_rp_origin()).hostname
    if not hostname:
        raise RuntimeError("Unable to determine WebAuthn RP ID from frontend origin.")
    return hostname


def generate_passkey_registration_options(
    request: Request,
    admin_user: AdminUser,
    db: Session,
    label: str,
) -> dict[str, object]:
    challenge = secrets.token_bytes(32)
    options = generate_registration_options(
        rp_id=get_rp_id(),
        rp_name=get_rp_name(),
        user_name=admin_user.username,
        user_id=admin_user.id.encode("utf-8"),
        user_display_name=admin_user.username,
        challenge=challenge,
        exclude_credentials=[
            PublicKeyCredentialDescriptor(
                id=base64url_to_bytes(passkey.credential_id),
                transports=[AuthenticatorTransport(transport) for transport in passkey.transports if transport],
            )
            for passkey in list_passkeys(db, admin_user)
        ],
    )
    request.session[SESSION_REGISTRATION_KEY] = {
        "challenge": bytes_to_base64url(challenge),
        "label": label.strip() or "Passkey",
    }
    return json.loads(options_to_json(options))


def verify_passkey_registration(
    request: Request,
    admin_user: AdminUser,
    db: Session,
    credential: dict[str, object],
) -> PasskeyCredential:
    session_data = request.session.get(SESSION_REGISTRATION_KEY)
    if not isinstance(session_data, dict) or "challenge" not in session_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active passkey registration.")

    verified = verify_registration_response(
        credential=credential,
        expected_challenge=base64url_to_bytes(str(session_data["challenge"])),
        expected_rp_id=get_rp_id(),
        expected_origin=get_rp_origin(),
    )
    credential_id = bytes_to_base64url(verified.credential_id)
    duplicate = db.execute(
        select(PasskeyCredential).where(PasskeyCredential.credential_id == credential_id)
    ).scalar_one_or_none()
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This passkey is already registered.")

    response = credential.get("response", {})
    response_data = cast(dict[str, Any], response) if isinstance(response, dict) else {}
    transports_raw = response_data.get("transports", [])
    transports = transports_raw if isinstance(transports_raw, list) else []
    passkey = PasskeyCredential(
        admin_user_id=admin_user.id,
        credential_id=credential_id,
        public_key=bytes_to_base64url(verified.credential_public_key),
        sign_count=verified.sign_count,
        transports=[str(item) for item in transports if isinstance(item, str)],
        label=str(session_data.get("label", "Passkey")),
    )
    db.add(passkey)
    write_audit_log(
        db,
        "admin_user",
        admin_user.id,
        "passkey_registered",
        {"credential_id": credential_id, "label": passkey.label},
    )
    db.commit()
    db.refresh(passkey)
    request.session.pop(SESSION_REGISTRATION_KEY, None)
    return passkey


def generate_passkey_authentication_options(request: Request, db: Session) -> dict[str, object]:
    passkeys = db.execute(
        select(PasskeyCredential)
        .join(AdminUser, AdminUser.id == PasskeyCredential.admin_user_id)
        .where(AdminUser.is_active.is_(True))
        .order_by(PasskeyCredential.created_at.asc())
    ).scalars().all()
    if not passkeys:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No passkeys are registered.")

    challenge = secrets.token_bytes(32)
    options = generate_authentication_options(
        rp_id=get_rp_id(),
        challenge=challenge,
        allow_credentials=[
            PublicKeyCredentialDescriptor(
                id=base64url_to_bytes(passkey.credential_id),
                transports=[AuthenticatorTransport(transport) for transport in passkey.transports if transport],
            )
            for passkey in passkeys
        ],
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    request.session[SESSION_AUTHENTICATION_KEY] = {"challenge": bytes_to_base64url(challenge)}
    return json.loads(options_to_json(options))


def verify_passkey_authentication(request: Request, db: Session, credential: dict[str, Any]) -> AdminUser:
    session_data = request.session.get(SESSION_AUTHENTICATION_KEY)
    if not isinstance(session_data, dict) or "challenge" not in session_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active passkey authentication.")

    credential_id = credential.get("id")
    if not isinstance(credential_id, str):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid passkey assertion.")

    passkey = db.execute(
        select(PasskeyCredential)
        .options(selectinload(PasskeyCredential.admin_user))
        .where(PasskeyCredential.credential_id == credential_id)
    ).scalar_one_or_none()
    if passkey is None or not passkey.admin_user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid passkey assertion.")

    verified = verify_authentication_response(
        credential=credential,
        expected_challenge=base64url_to_bytes(str(session_data["challenge"])),
        expected_rp_id=get_rp_id(),
        expected_origin=get_rp_origin(),
        credential_public_key=base64url_to_bytes(passkey.public_key),
        credential_current_sign_count=passkey.sign_count,
    )
    passkey.sign_count = verified.new_sign_count
    passkey.last_used_at = datetime.now(UTC)
    passkey.admin_user.last_login_at = datetime.now(UTC)
    db.commit()
    request.session.pop(SESSION_AUTHENTICATION_KEY, None)
    return passkey.admin_user

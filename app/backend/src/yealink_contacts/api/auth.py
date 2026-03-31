from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from yealink_contacts.api.deps import current_admin_user, db_session
from yealink_contacts.models.auth import AdminUser
from yealink_contacts.schemas.auth import (
    AuthenticatedAdminResponse,
    ChangePasswordRequest,
    LoginRequest,
    PasskeyAuthenticationVerifyRequest,
    PasskeyCredentialResponse,
    PasskeyRegistrationOptionsRequest,
    PasskeyRegistrationVerifyRequest,
    PublicKeyOptionsResponse,
)
from yealink_contacts.schemas.common import MessageResponse
from yealink_contacts.services.auth_service import (
    build_auth_response,
    change_password,
    delete_passkey,
    generate_passkey_authentication_options,
    generate_passkey_registration_options,
    list_passkeys,
    login_with_password,
    logout_session,
    persist_session_login,
    verify_passkey_authentication,
    verify_passkey_registration,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AuthenticatedAdminResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(db_session)) -> AuthenticatedAdminResponse:
    admin_user = login_with_password(db, payload.username, payload.password)
    persist_session_login(request, admin_user)
    return build_auth_response(db, admin_user)


@router.post("/logout", response_model=MessageResponse)
def logout(request: Request) -> MessageResponse:
    logout_session(request)
    return MessageResponse(message="Logged out.")


@router.get("/me", response_model=AuthenticatedAdminResponse)
def me(admin_user: AdminUser = Depends(current_admin_user), db: Session = Depends(db_session)) -> AuthenticatedAdminResponse:
    return build_auth_response(db, admin_user)


@router.post("/change-password", response_model=AuthenticatedAdminResponse)
def update_password(
    payload: ChangePasswordRequest,
    request: Request,
    admin_user: AdminUser = Depends(current_admin_user),
    db: Session = Depends(db_session),
) -> AuthenticatedAdminResponse:
    updated_user = change_password(db, admin_user, payload.current_password, payload.new_password)
    persist_session_login(request, updated_user)
    return build_auth_response(db, updated_user)


@router.get("/passkeys", response_model=list[PasskeyCredentialResponse])
def passkeys(admin_user: AdminUser = Depends(current_admin_user), db: Session = Depends(db_session)) -> list[PasskeyCredentialResponse]:
    return [PasskeyCredentialResponse.model_validate(item) for item in list_passkeys(db, admin_user)]


@router.post("/passkeys/registration/options", response_model=PublicKeyOptionsResponse)
def passkey_registration_options(
    payload: PasskeyRegistrationOptionsRequest,
    request: Request,
    admin_user: AdminUser = Depends(current_admin_user),
    db: Session = Depends(db_session),
) -> PublicKeyOptionsResponse:
    return PublicKeyOptionsResponse(
        options=generate_passkey_registration_options(request, admin_user, db, payload.label)
    )


@router.post("/passkeys/registration/verify", response_model=PasskeyCredentialResponse, status_code=status.HTTP_201_CREATED)
def passkey_registration_verify(
    payload: PasskeyRegistrationVerifyRequest,
    request: Request,
    admin_user: AdminUser = Depends(current_admin_user),
    db: Session = Depends(db_session),
) -> PasskeyCredentialResponse:
    return PasskeyCredentialResponse.model_validate(
        verify_passkey_registration(request, admin_user, db, payload.credential)
    )


@router.post("/passkeys/authentication/options", response_model=PublicKeyOptionsResponse)
def passkey_authentication_options(request: Request, db: Session = Depends(db_session)) -> PublicKeyOptionsResponse:
    return PublicKeyOptionsResponse(options=generate_passkey_authentication_options(request, db))


@router.post("/passkeys/authentication/verify", response_model=AuthenticatedAdminResponse)
def passkey_authentication_verify(
    payload: PasskeyAuthenticationVerifyRequest,
    request: Request,
    db: Session = Depends(db_session),
) -> AuthenticatedAdminResponse:
    admin_user = verify_passkey_authentication(request, db, payload.credential)
    persist_session_login(request, admin_user)
    return build_auth_response(db, admin_user)


@router.delete("/passkeys/{passkey_id}", response_model=MessageResponse)
def remove_passkey(
    passkey_id: str,
    admin_user: AdminUser = Depends(current_admin_user),
    db: Session = Depends(db_session),
) -> MessageResponse:
    delete_passkey(db, admin_user, passkey_id)
    return MessageResponse(message="Passkey removed.")


@router.get("/access/admin", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def admin_access_check() -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)

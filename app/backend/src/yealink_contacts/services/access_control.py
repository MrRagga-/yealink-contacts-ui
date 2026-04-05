from __future__ import annotations

from dataclasses import dataclass
from ipaddress import IPv4Address, IPv6Address
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from yealink_contacts.models.auth import AdminUser
from yealink_contacts.services.auth_service import SESSION_USER_ID_KEY, get_admin_user_by_id
from yealink_contacts.services.network_security import ip_matches_cidrs, resolve_client_ip

DOCS_PATHS = {"/docs", "/redoc", "/openapi.json"}
ADMIN_NETWORK_ONLY_PATHS = {
    "/api/auth/login",
    "/api/auth/passkeys/authentication/options",
    "/api/auth/passkeys/authentication/verify",
    "/api/auth/access/admin",
}
MUST_CHANGE_ALLOWED_PATHS = {
    "/api/auth/me",
    "/api/auth/change-password",
    "/api/auth/logout",
    "/api/auth/passkeys/authentication/options",
    "/api/auth/passkeys/authentication/verify",
}


@dataclass(frozen=True)
class RequestNetworkContext:
    path: str
    method: str
    peer_host: str | None
    forwarded_for: str | None
    trusted_proxy_cidrs: list[str]
    client_ip: IPv4Address | IPv6Address


def is_healthz(path: str) -> bool:
    return path == "/healthz"


def is_docs(path: str) -> bool:
    return path in DOCS_PATHS


def is_xml_endpoint(path: str) -> bool:
    return path.startswith("/api/yealink/phonebook/") and path.endswith(".xml")


def is_admin_network_only(path: str) -> bool:
    return path in ADMIN_NETWORK_ONLY_PATHS


def is_session_exempt(path: str) -> bool:
    return is_healthz(path) or is_xml_endpoint(path) or is_admin_network_only(path)


def is_must_change_allowed(path: str) -> bool:
    return path in MUST_CHANGE_ALLOWED_PATHS


def is_admin_surface(path: str) -> bool:
    return path.startswith("/api") or is_docs(path)


def build_request_network_context(request: Request, trusted_proxy_cidrs: list[str]) -> RequestNetworkContext:
    peer_host = request.client.host if request.client else None
    forwarded_for = request.headers.get("x-forwarded-for")
    return RequestNetworkContext(
        path=request.url.path,
        method=request.method,
        peer_host=peer_host,
        forwarded_for=forwarded_for,
        trusted_proxy_cidrs=trusted_proxy_cidrs,
        client_ip=resolve_client_ip(peer_host, forwarded_for, trusted_proxy_cidrs),
    )


def build_access_request_context(request: Request, settings: Any) -> RequestNetworkContext:
    return build_request_network_context(request, settings.resolved_trusted_proxy_cidrs)


def log_acl_debug(
    logger: Any,
    *,
    context: RequestNetworkContext,
    scope: str,
    allowed_cidrs: list[str],
    allowed: bool,
) -> None:
    logger.info(
        "acl_ip_debug",
        path=context.path,
        method=context.method,
        scope=scope,
        peer_host=context.peer_host,
        x_forwarded_for=context.forwarded_for,
        trusted_proxy_cidrs=context.trusted_proxy_cidrs,
        resolved_client_ip=str(context.client_ip),
        allowed_cidrs=allowed_cidrs,
        allowed=allowed,
    )


def is_cidr_allowed(
    context: RequestNetworkContext,
    allowed_cidrs: list[str],
    *,
    logger: Any,
    scope: str,
    debug_enabled: bool,
) -> bool:
    is_allowed = ip_matches_cidrs(context.client_ip, allowed_cidrs)
    if debug_enabled:
        log_acl_debug(
            logger,
            context=context,
            scope=scope,
            allowed_cidrs=allowed_cidrs,
            allowed=is_allowed,
        )
    return is_allowed


def get_session_admin_user(request: Request, db: Session) -> AdminUser | None:
    session_data = request.scope.get("session")
    admin_user_id = session_data.get(SESSION_USER_ID_KEY) if isinstance(session_data, dict) else None
    if not isinstance(admin_user_id, str):
        return None

    admin_user = get_admin_user_by_id(db, admin_user_id)
    if admin_user is not None:
        return admin_user

    if isinstance(session_data, dict):
        session_data.clear()
    return None

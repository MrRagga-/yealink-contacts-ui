from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware

import yealink_contacts.models  # noqa: F401
from yealink_contacts.api.router import api_router
from yealink_contacts.core.config import get_settings
from yealink_contacts.core.logging import configure_logging
from yealink_contacts.core.version import get_app_version
from yealink_contacts.db.session import SessionLocal, init_db
from yealink_contacts.services.export_service import ensure_default_profiles
from yealink_contacts.services.auth_service import SESSION_USER_ID_KEY, get_admin_user_by_id, seed_bootstrap_admin
from yealink_contacts.services.network_security import ip_matches_cidrs, normalize_cidrs, resolve_client_ip
from yealink_contacts.services.settings_service import get_app_settings

settings = get_settings()
configure_logging(settings.log_level)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    with SessionLocal() as session:
        ensure_default_profiles(session)
        seed_bootstrap_admin(session)
    yield


app = FastAPI(title=settings.app_name, version=get_app_version(), lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
def _is_healthz(path: str) -> bool:
    return path == "/healthz"


def _is_docs(path: str) -> bool:
    return path in {"/docs", "/redoc", "/openapi.json"}


def _is_xml_endpoint(path: str) -> bool:
    return path.startswith("/api/yealink/phonebook/") and path.endswith(".xml")


def _is_admin_network_only(path: str) -> bool:
    return path in {
        "/api/auth/login",
        "/api/auth/passkeys/authentication/options",
        "/api/auth/passkeys/authentication/verify",
        "/api/auth/access/admin",
    }


def _is_session_exempt(path: str) -> bool:
    return _is_healthz(path) or _is_xml_endpoint(path) or _is_admin_network_only(path)


def _is_must_change_allowed(path: str) -> bool:
    return path in {
        "/api/auth/me",
        "/api/auth/change-password",
        "/api/auth/logout",
        "/api/auth/passkeys/authentication/options",
        "/api/auth/passkeys/authentication/verify",
    }


class AccessControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method == "OPTIONS" or _is_healthz(path):
            return await call_next(request)

        client_ip = resolve_client_ip(
            request.client.host if request.client else None,
            request.headers.get("x-forwarded-for"),
            normalize_cidrs(settings.trusted_proxy_cidrs),
        )

        if _is_xml_endpoint(path):
            with SessionLocal() as session:
                app_settings = get_app_settings(session)
            if not ip_matches_cidrs(client_ip, app_settings.xml_allowed_cidrs):
                return JSONResponse({"detail": "XML endpoint is not allowed from this IP range."}, status_code=403)
            return await call_next(request)

        if path.startswith("/api") or _is_docs(path):
            with SessionLocal() as session:
                app_settings = get_app_settings(session)
                if not ip_matches_cidrs(client_ip, app_settings.admin_allowed_cidrs):
                    return JSONResponse({"detail": "Admin access is not allowed from this IP range."}, status_code=403)

                if _is_session_exempt(path):
                    return await call_next(request)

                session_data = request.scope.get("session")
                admin_user_id = session_data.get(SESSION_USER_ID_KEY) if isinstance(session_data, dict) else None
                if not isinstance(admin_user_id, str):
                    return JSONResponse({"detail": "Authentication required."}, status_code=401)

                admin_user = get_admin_user_by_id(session, admin_user_id)
                if admin_user is None:
                    if isinstance(session_data, dict):
                        session_data.clear()
                    return JSONResponse({"detail": "Authentication required."}, status_code=401)

                if admin_user.must_change_password and not _is_must_change_allowed(path):
                    return JSONResponse(
                        {"detail": "You must change your password before accessing the admin UI."},
                        status_code=403,
                    )

        return await call_next(request)


app.add_middleware(AccessControlMiddleware)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.app_secret_key,
    session_cookie=settings.session_cookie_name,
    max_age=settings.session_max_age_seconds,
    same_site="lax",
    https_only=settings.app_env != "development",
)

app.include_router(api_router, prefix="/api")


@app.get("/healthz")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}

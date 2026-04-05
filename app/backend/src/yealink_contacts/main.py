from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import structlog

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
from yealink_contacts.services.auth_service import seed_bootstrap_admin
from yealink_contacts.services.access_control import (
    build_access_request_context,
    get_session_admin_user,
    is_admin_surface,
    is_cidr_allowed,
    is_healthz,
    is_must_change_allowed,
    is_session_exempt,
    is_xml_endpoint,
)
from yealink_contacts.services.settings_service import get_app_settings

settings = get_settings()
configure_logging(settings.log_level)
logger = structlog.get_logger(__name__)


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
class AccessControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        context = build_access_request_context(request, settings)
        if context.method == "OPTIONS" or is_healthz(context.path):
            return await call_next(request)

        if is_xml_endpoint(context.path):
            with SessionLocal() as session:
                app_settings = get_app_settings(session)
            xml_allowed_cidrs = settings.resolve_xml_allowed_cidrs(app_settings.xml_allowed_cidrs)
            is_allowed = is_cidr_allowed(
                context,
                xml_allowed_cidrs,
                logger=logger,
                scope="xml",
                debug_enabled=app_settings.debug_enabled,
            )
            if not is_allowed:
                return JSONResponse({"detail": "XML endpoint is not allowed from this IP range."}, status_code=403)
            return await call_next(request)

        if is_admin_surface(context.path):
            with SessionLocal() as session:
                app_settings = get_app_settings(session)
                admin_allowed_cidrs = settings.resolve_admin_allowed_cidrs(app_settings.admin_allowed_cidrs)
                is_allowed = is_cidr_allowed(
                    context,
                    admin_allowed_cidrs,
                    logger=logger,
                    scope="admin",
                    debug_enabled=app_settings.debug_enabled,
                )
                if not is_allowed:
                    return JSONResponse({"detail": "Admin access is not allowed from this IP range."}, status_code=403)

                if is_session_exempt(context.path):
                    return await call_next(request)

                admin_user = get_session_admin_user(request, session)
                if admin_user is None:
                    return JSONResponse({"detail": "Authentication required."}, status_code=401)

                if admin_user.must_change_password and not is_must_change_allowed(context.path):
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

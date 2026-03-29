from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import yealink_contacts.models  # noqa: F401
from yealink_contacts.api.router import api_router
from yealink_contacts.core.config import get_settings
from yealink_contacts.core.logging import configure_logging
from yealink_contacts.core.version import get_app_version
from yealink_contacts.db.session import init_db
from yealink_contacts.db.session import SessionLocal
from yealink_contacts.services.export_service import ensure_default_profiles

settings = get_settings()
configure_logging(settings.log_level)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    with SessionLocal() as session:
        ensure_default_profiles(session)
    yield


app = FastAPI(title=settings.app_name, version=get_app_version(), lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/healthz")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}

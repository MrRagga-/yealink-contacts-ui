from __future__ import annotations

from fastapi import APIRouter

from yealink_contacts.api.auth import router as auth_router
from yealink_contacts.api.config import router as config_router
from yealink_contacts.api.contacts import router as contacts_router
from yealink_contacts.api.dashboard import router as dashboard_router
from yealink_contacts.api.export_profiles import router as export_profiles_router
from yealink_contacts.api.exports import router as exports_router
from yealink_contacts.api.jobs import router as jobs_router
from yealink_contacts.api.logs import router as logs_router
from yealink_contacts.api.settings import router as settings_router
from yealink_contacts.api.sources import router as sources_router
from yealink_contacts.api.yealink import router as yealink_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(dashboard_router)
api_router.include_router(sources_router)
api_router.include_router(contacts_router)
api_router.include_router(export_profiles_router)
api_router.include_router(exports_router)
api_router.include_router(jobs_router)
api_router.include_router(logs_router)
api_router.include_router(settings_router)
api_router.include_router(config_router)
api_router.include_router(yealink_router)

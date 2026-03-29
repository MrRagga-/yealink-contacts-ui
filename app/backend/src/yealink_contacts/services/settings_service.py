from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from yealink_contacts.core.version import get_app_version
from yealink_contacts.models.app_setting import AppSetting
from yealink_contacts.schemas.settings import AppSettingsResponse, AppSettingsUpdate
from yealink_contacts.services.audit import write_audit_log

SETTINGS_ENTITY_ID = "global"


def get_app_settings(db: Session) -> AppSettingsResponse:
    values = AppSettingsResponse().model_dump()
    values["app_version"] = get_app_version()
    values["release_model"] = "Semantic Versioning via Git tags"
    items = db.execute(select(AppSetting)).scalars().all()
    for item in items:
        if item.key in values:
            values[item.key] = item.value
    return AppSettingsResponse.model_validate(values)


def update_app_settings(db: Session, payload: AppSettingsUpdate) -> AppSettingsResponse:
    current = get_app_settings(db)
    updated = current.model_copy(update=payload.model_dump(exclude_none=True))

    for key, value in updated.model_dump().items():
        item = db.execute(select(AppSetting).where(AppSetting.key == key)).scalar_one_or_none()
        if item is None:
            db.add(AppSetting(key=key, value=value))
        else:
            item.value = value

    write_audit_log(
        db,
        "settings",
        SETTINGS_ENTITY_ID,
        "updated",
        payload.model_dump(exclude_none=True),
    )
    db.commit()
    return get_app_settings(db)

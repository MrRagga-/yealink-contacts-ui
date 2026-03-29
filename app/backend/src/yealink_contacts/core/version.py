from __future__ import annotations

import os
from functools import lru_cache
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
import tomllib


@lru_cache(maxsize=1)
def get_app_version() -> str:
    explicit_version = os.getenv("APP_VERSION")
    if explicit_version:
        return explicit_version

    try:
        return version("yealink-contacts-backend")
    except PackageNotFoundError:
        pyproject_path = Path(__file__).resolve().parents[3] / "pyproject.toml"
        if pyproject_path.exists():
            with pyproject_path.open("rb") as handle:
                payload = tomllib.load(handle)
            return str(payload.get("project", {}).get("version", "0.1.0"))
    return "0.1.0"

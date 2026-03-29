from __future__ import annotations

import hashlib
import re


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return normalized or "item"


def content_hash(payload: dict) -> str:
    digest = hashlib.sha256(repr(sorted(payload.items())).encode("utf-8"))
    return digest.hexdigest()


def collapse_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()

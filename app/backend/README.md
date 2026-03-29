# Yealink Contacts Sync Backend

FastAPI backend for the Yealink Contacts Sync project.

Development workflow for this package is managed with `uv`, the dependency lock lives in `uv.lock`, and Python typing is checked with `ty`.

Common commands:

```bash
uv sync --locked --extra dev
uv run pytest
uv run ty check src
uv run uvicorn yealink_contacts.main:app --reload --host 0.0.0.0 --port 8000
```

This package provides:

- source adapters for Google Contacts and CardDAV
- canonical contact storage and normalization
- rule-based export previews
- Yealink Remote Phonebook XML rendering
- sync jobs, audit logging, and REST APIs

Project repository:

- https://github.com/MrRagga-/yealink-contacts-ui

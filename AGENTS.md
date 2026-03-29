# AGENTS.md

## Overview

This repository is a local-first Yealink contact sync tool with:

- a Python backend in `/app/backend`
- a React frontend in `/app/frontend`
- Docker-based local deployment from the repo root

## Tooling

- Manage all Python dependencies and local Python commands with `uv`
- Run Python typing checks with `ty`
- Use `npm` for the frontend

Backend defaults:

```bash
cd app/backend
uv sync --locked --extra dev
uv run pytest
uv run ty check src
uv run uvicorn yealink_contacts.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend defaults:

```bash
cd app/frontend
npm install
npm run test -- --run
npm run build
npm run dev -- --host 0.0.0.0 --port 5173
```

## Architecture

- Backend API: FastAPI
- ORM: SQLAlchemy 2.x
- Schemas: Pydantic v2
- Migrations: Alembic
- Source adapters live under `app/backend/src/yealink_contacts/adapters/sources`
- Yealink output adapter lives under `app/backend/src/yealink_contacts/adapters/outputs/yealink`
- Rules logic lives under `app/backend/src/yealink_contacts/rules`
- Frontend pages live under `app/frontend/src/pages`

## Working Rules

- Prefer small, explicit changes over broad refactors
- Keep source adapters and output adapters decoupled
- Preserve the canonical contact model shape unless a migration is intentional
- Do not introduce Python package managers other than `uv`
- Do not introduce alternative Python type checkers in parallel with `ty`
- Keep Docker Hub as the only automated image registry unless the release model is explicitly changed

## Verification

For backend-affecting changes, run:

```bash
cd app/backend
uv run pytest
uv run ty check src
```

For frontend-affecting changes, run:

```bash
cd app/frontend
npm run test -- --run
npm run build
```

For release or container changes, also run:

```bash
docker compose config
docker build -f app/backend/Dockerfile -t yealink-backend-test .
docker build -f app/frontend/Dockerfile -t yealink-frontend-test .
```

## Releases

- Release tags use Semantic Versioning: `vMAJOR.MINOR.PATCH`
- The GitHub release workflow publishes Docker images to Docker Hub
- The workflow also attaches SBOM artifacts to the GitHub release

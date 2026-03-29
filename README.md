<p align="center">
  <img src="app/frontend/public/logo-mark.svg" alt="Yealink Contacts Sync logo" width="160" />
</p>

<h1 align="center">Yealink Contacts Sync</h1>

<p align="center">
  Import, normalize, filter, preview, and publish remote phonebooks with a Yealink-focused admin UI.
</p>

<p align="center">
  <a href="https://github.com/MrRagga-/yealink-contacts-ui/actions/workflows/ci.yml"><img src="https://github.com/MrRagga-/yealink-contacts-ui/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/MrRagga-/yealink-contacts-ui/actions/workflows/release.yml"><img src="https://github.com/MrRagga-/yealink-contacts-ui/actions/workflows/release.yml/badge.svg" alt="Release" /></a>
  <a href="https://github.com/MrRagga-/yealink-contacts-ui/actions/workflows/codeql.yml"><img src="https://github.com/MrRagga-/yealink-contacts-ui/actions/workflows/codeql.yml/badge.svg" alt="CodeQL" /></a>
  <a href="https://hub.docker.com/r/mrragga/yealink-contacts-ui"><img src="https://img.shields.io/docker/pulls/mrragga/yealink-contacts-ui?logo=docker" alt="Docker Hub pulls" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="Apache 2.0 License" /></a>
</p>

Local admin tool for importing, normalizing, filtering, previewing, and serving contacts as Yealink Remote Phonebook XML.

## Highlights

- FastAPI backend with SQLAlchemy 2, Pydantic v2, Alembic, HTTPX, Google People API, and CardDAV over raw WebDAV/CardDAV requests
- React 18 + TypeScript frontend with forms, previews, source management, sync jobs, and Yealink export guidance
- Preview-first export flow with explainable filtering and number selection
- Yealink XML endpoints under `/api/yealink/phonebook/{profile}.xml`
- Per-source merge strategy:
  - import and update only
  - mirror source and delete locally removed contacts
- Release-ready container images for backend and frontend
- GitHub Actions for CI, tagged releases, Docker Hub publishing, and SBOM generation

## Versioning and releases

This project uses Semantic Versioning.

- Tag releases as `vMAJOR.MINOR.PATCH`
- Example tags: `v0.2.0`, `v1.0.0`
- The backend exposes the application version in the About page and derives it from:
  1. `APP_VERSION` in CI or runtime
  2. the installed backend package version
  3. the backend `pyproject.toml` version as fallback

The GitHub release workflow is configured to:

- publish multi-arch backend and frontend images
- push to Docker Hub
- generate SPDX JSON SBOMs
- attach SBOMs to the GitHub release

## Repository layout

```text
.
├── app
│   ├── backend
│   │   ├── alembic
│   │   ├── src/yealink_contacts
│   │   │   ├── adapters
│   │   │   ├── api
│   │   │   ├── core
│   │   │   ├── db
│   │   │   ├── dedup
│   │   │   ├── jobs
│   │   │   ├── models
│   │   │   ├── rules
│   │   │   ├── schemas
│   │   │   ├── services
│   │   │   └── tests
│   └── frontend
│       ├── src/components
│       ├── src/features
│       ├── src/hooks
│       ├── src/lib
│       ├── src/pages
│       ├── src/tests
│       └── src/types
├── .github
├── docker-compose.yml
├── Makefile
└── README.md
```

## Local development

### Option 1: Docker Compose

1. Copy `.env.example` to `.env`
2. Review `APP_SECRET_KEY` and `ENCRYPTION_KEY`
3. Run `docker compose up --build`
4. Frontend: [http://localhost:5173](http://localhost:5173)
5. Backend/OpenAPI: [http://localhost:8000/docs](http://localhost:8000/docs)

The Docker Compose setup now serves the frontend through Nginx on port `5173` and proxies `/api` and `/healthz` to the backend.

### Option 2: Local uv and npm

1. `cp .env.example .env`
2. Install `uv`
3. `cd app/backend && uv sync --locked --extra dev`
4. `cd app/frontend && npm install`
5. Backend: `make backend-dev`
6. Frontend: `make frontend-dev`

The backend dependency graph is locked in `app/backend/uv.lock`, local commands are executed through `uv run`, and Python typing is enforced with `ty`.

## Demo data

Create demo data:

```bash
cd app/backend
uv run python -m yealink_contacts.jobs.seed_demo
```

## Source setup

### Google OAuth

1. Create a Google OAuth client for a web application in Google Cloud Console
2. Enable the People API in the same project
3. Create a `google` source in the UI
4. Enter the client ID, client secret, and redirect URI directly on the source
5. Register the exact same redirect URI in Google, for example:
   - `http://localhost:8000/api/sources/oauth/google/callback`
6. In the source list, click `Google OAuth`
7. Complete the consent flow
8. Run `Start sync`

### CardDAV and Nextcloud

1. Create a source of type `carddav` or `nextcloud_carddav`
2. Enter the server URL, username, and password or app password
3. Run `Test connection`
4. Run `Load address books`
5. Select the relevant address books
6. Run `Start sync`

Typical Nextcloud URL:

- `https://<host>/remote.php/dav/addressbooks/users/<username>/`

## Merge strategy

Each source can define how local data behaves when contacts disappear from the upstream source:

- `Import and update only, never delete locally`
- `Mirror source and delete locally removed contacts`

Contact updates already happen during sync through upsert behavior keyed by `source_id + source_contact_id`.

## Yealink setup

1. Create or edit an export profile in `Rules`
2. Validate the result in `Export / Yealink`
3. Copy the XML endpoint, for example:
   - `http://<tool-host>:8000/api/yealink/phonebook/default.xml`
4. In Yealink, configure the remote phonebook under:
   - `Directory > Remote Phonebook`
5. For centrally managed devices, roll out the Yealink provisioning keys that reference this XML URL

## Container publishing

The release workflow publishes:

- `<dockerhub-user>/yealink-contacts-ui:backend-<tag>`
- `<dockerhub-user>/yealink-contacts-ui:frontend-<tag>`
- `<dockerhub-user>/yealink-contacts-ui:backend-latest`
- `<dockerhub-user>/yealink-contacts-ui:frontend-latest`

Example pulls:

```bash
docker pull <dockerhub-user>/yealink-contacts-ui:backend-v0.1.0
docker pull <dockerhub-user>/yealink-contacts-ui:frontend-v0.1.0
```

Required GitHub secrets for Docker Hub publishing:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

## SBOM and supply chain

The release workflow includes:

- SPDX JSON SBOM generation for backend and frontend images
- artifact upload to GitHub Releases

## Tests

Backend:

```bash
cd app/backend
uv sync --locked --extra dev
uv run pytest
uv run ty check src
```

Frontend:

```bash
cd app/frontend
npm run test -- --run
npm run build
```

## Open-source project hygiene

This repository includes:

- Apache-2.0 license
- CI workflow
- release workflow
- CodeQL workflow
- Dependabot configuration
- issue forms and PR template
- CODEOWNERS
- code of conduct
- contributing guide
- security policy
- support guide
- third-party notices
- security policy
- code of conduct
- pull request template

Recommended next steps after publishing:

1. Replace badge placeholders with the final GitHub org or user name
2. Add issue templates
3. Add CODEOWNERS if the maintainer set is stable
4. Enable branch protection on the default branch
5. Require CI to pass before merge

## Security and operations notes

- Secrets are stored encrypted in the backend database
- XML endpoints are intended for trusted LAN or reverse-proxied use
- CORS is restricted through `FRONTEND_ORIGIN`
- Logs do not contain decrypted credentials
- Audit logs and job events are exposed through `/api/logs`

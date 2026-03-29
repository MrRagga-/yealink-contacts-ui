# Third-Party Notices

This project depends on third-party open-source software. Licenses for direct dependencies are governed by their respective upstream packages.

## Backend ecosystem

Notable direct dependencies include:

- FastAPI
- SQLAlchemy
- Alembic
- HTTPX
- google-api-python-client
- google-auth
- google-auth-oauthlib
- phonenumbers
- psycopg
- structlog
- uvicorn
- vobject

## Frontend ecosystem

Notable direct dependencies include:

- React
- React DOM
- React Router
- TanStack Query
- TanStack Table
- React Hook Form
- Zod
- Vite
- Vitest

## Container and CI ecosystem

The project also uses GitHub Actions and container base images maintained by third parties, including:

- Python base images
- Node.js base images
- Nginx base images
- Docker GitHub Actions
- GitHub official Actions

## Source of truth

For exact package versions, refer to:

- `app/backend/pyproject.toml`
- `app/frontend/package.json`
- `app/frontend/package-lock.json`
- `.github/workflows/*.yml`

If you distribute this project in a regulated environment, generate and archive the release SBOM artifacts produced by the release workflow.

PYTHON ?= python3
NPM ?= npm
DEV_FRONTEND_ORIGIN ?= http://localhost:5173

.PHONY: backend-install frontend-install e2e-install install backend-dev frontend-dev dev backend-test backend-typecheck frontend-test e2e-test test hooks-install docker-smoke

backend-install:
	cd app/backend && uv sync --locked --extra dev

frontend-install:
	cd app/frontend && $(NPM) install

e2e-install:
	cd e2e && $(NPM) install
	cd e2e && npx playwright install chromium

install: backend-install frontend-install e2e-install

backend-dev:
	cd app/backend && \
		APP_ENV=development \
		FRONTEND_ORIGIN=$(DEV_FRONTEND_ORIGIN) \
		WEBAUTHN_RP_ORIGIN=$(DEV_FRONTEND_ORIGIN) \
		WEBAUTHN_RP_ID=localhost \
		DATABASE_URL=sqlite:///./yealink_contacts.db \
		uv run uvicorn yealink_contacts.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev:
	cd app/frontend && $(NPM) run dev -- --host localhost --port 5173

dev:
	docker compose -f docker-compose.dev.yml up --build

hooks-install:
	prek install --hook-type pre-push --install-hooks --overwrite

docker-smoke:
	./scripts/verify-docker-stack.sh

backend-test:
	cd app/backend && DATABASE_URL=sqlite:///./test_yealink_contacts.db uv run pytest

backend-typecheck:
	cd app/backend && uv run ty check src

frontend-test:
	cd app/frontend && $(NPM) run test -- --run

e2e-test:
	cd e2e && $(NPM) test

test: backend-test backend-typecheck frontend-test

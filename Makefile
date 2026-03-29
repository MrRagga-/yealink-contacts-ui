PYTHON ?= python3
NPM ?= npm

.PHONY: backend-install frontend-install install backend-dev frontend-dev dev backend-test backend-typecheck frontend-test test

backend-install:
	cd app/backend && uv sync --locked --extra dev

frontend-install:
	cd app/frontend && $(NPM) install

install: backend-install frontend-install

backend-dev:
	cd app/backend && DATABASE_URL=sqlite:///./yealink_contacts.db uv run uvicorn yealink_contacts.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev:
	cd app/frontend && $(NPM) run dev -- --host 0.0.0.0 --port 5173

dev:
	docker compose up --build

backend-test:
	cd app/backend && DATABASE_URL=sqlite:///./test_yealink_contacts.db uv run pytest

backend-typecheck:
	cd app/backend && uv run ty check src

frontend-test:
	cd app/frontend && $(NPM) run test -- --run

test: backend-test backend-typecheck frontend-test

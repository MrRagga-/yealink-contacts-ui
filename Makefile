PYTHON ?= python3
NPM ?= npm

.PHONY: backend-install frontend-install install backend-dev frontend-dev dev backend-test frontend-test test

backend-install:
	cd app/backend && $(PYTHON) -m pip install -e ".[dev]"

frontend-install:
	cd app/frontend && $(NPM) install

install: backend-install frontend-install

backend-dev:
	cd app/backend && DATABASE_URL=sqlite:///./yealink_contacts.db uvicorn yealink_contacts.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev:
	cd app/frontend && $(NPM) run dev -- --host 0.0.0.0 --port 5173

dev:
	docker compose up --build

backend-test:
	cd app/backend && DATABASE_URL=sqlite:///./test_yealink_contacts.db pytest

frontend-test:
	cd app/frontend && $(NPM) run test -- --run

test: backend-test frontend-test

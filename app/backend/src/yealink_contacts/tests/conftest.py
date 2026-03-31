from __future__ import annotations

import os

os.environ.setdefault("APP_SECRET_KEY", "test-secret-key")
os.environ.setdefault("ENCRYPTION_KEY", "S4aexYnjREGeQkSQIlPCXSQLgXUhY_GfJ1i1n1a34zg=")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_yealink_contacts.db")

import pytest
from fastapi.testclient import TestClient

from yealink_contacts.db.base import Base
from yealink_contacts.db.session import SessionLocal, engine
from yealink_contacts.main import app
from yealink_contacts.services.export_service import invalidate_phonebook_cache


@pytest.fixture(autouse=True)
def reset_db():
    invalidate_phonebook_cache()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    invalidate_phonebook_cache()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def admin_client(client: TestClient) -> TestClient:
    login = client.post("/api/auth/login", json={"username": "admin", "password": "admin"})
    assert login.status_code == 200
    changed = client.post(
        "/api/auth/change-password",
        json={"current_password": "admin", "new_password": "admin-password"},
    )
    assert changed.status_code == 200
    return client

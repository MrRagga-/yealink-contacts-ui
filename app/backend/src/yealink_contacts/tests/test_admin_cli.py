from __future__ import annotations

import yealink_contacts.models  # noqa: F401
from sqlalchemy import select
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from yealink_contacts.db.base import Base
from yealink_contacts.jobs import admin as admin_cli
from yealink_contacts.models.auth import AdminUser
from yealink_contacts.models.audit import AuditLog
from yealink_contacts.services.auth_service import password_hash


def _capture_output(target: list[str]):
    return lambda message: target.append(message)


def _bind_cli_to_temp_db(monkeypatch, tmp_path):
    database_path = tmp_path / "admin-cli.sqlite"
    engine = create_engine(f"sqlite:///{database_path}", future=True, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    monkeypatch.setattr(admin_cli, "SessionLocal", session_factory)
    monkeypatch.setattr(admin_cli, "init_db", lambda: Base.metadata.create_all(bind=engine))
    return session_factory


def test_admin_cli_lists_seeded_bootstrap_user(monkeypatch, tmp_path):
    _bind_cli_to_temp_db(monkeypatch, tmp_path)
    stdout: list[str] = []

    exit_code = admin_cli.main(["list-users"], stdout=_capture_output(stdout), stderr=lambda _: None)

    assert exit_code == 0
    assert stdout
    assert stdout[0].startswith("admin\tactive=True\tmust_change_password=True")


def test_admin_cli_resets_password_and_can_require_follow_up_change(monkeypatch, tmp_path):
    session_factory = _bind_cli_to_temp_db(monkeypatch, tmp_path)
    prompts = iter(["super-secret-password", "super-secret-password"])
    stdout: list[str] = []
    stderr: list[str] = []

    exit_code = admin_cli.main(
        ["reset-password", "--username", "admin", "--must-change-password"],
        password_prompt=lambda _: next(prompts),
        stdout=_capture_output(stdout),
        stderr=_capture_output(stderr),
    )

    assert exit_code == 0
    assert not stderr

    with session_factory() as verify_db:
        admin_user = verify_db.execute(select(AdminUser).where(AdminUser.username == "admin")).scalar_one()
        assert admin_user.must_change_password is True
        assert password_hash.verify("super-secret-password", admin_user.password_hash)
        audits = verify_db.execute(select(AuditLog).where(AuditLog.action == "password_reset")).scalars().all()
        assert any(audit.payload["username"] == "admin" for audit in audits)


def test_admin_cli_creates_and_deactivates_user(monkeypatch, tmp_path):
    session_factory = _bind_cli_to_temp_db(monkeypatch, tmp_path)
    prompts = iter(["another-secret", "another-secret"])
    stdout: list[str] = []

    create_exit = admin_cli.main(
        ["create-user", "--username", "ops-admin", "--no-must-change-password"],
        password_prompt=lambda _: next(prompts),
        stdout=_capture_output(stdout),
        stderr=lambda _: None,
    )

    assert create_exit == 0
    with session_factory() as verify_db:
        created = verify_db.execute(select(AdminUser).where(AdminUser.username == "ops-admin")).scalar_one()
        assert created.must_change_password is False
        assert created.is_active is True

    deactivate_exit = admin_cli.main(
        ["deactivate-user", "--username", "ops-admin"],
        stdout=lambda _: None,
        stderr=lambda _: None,
    )
    assert deactivate_exit == 0
    with session_factory() as verify_db:
        deactivated = verify_db.execute(select(AdminUser).where(AdminUser.username == "ops-admin")).scalar_one()
        assert deactivated.is_active is False

    activate_exit = admin_cli.main(
        ["activate-user", "--username", "ops-admin"],
        stdout=lambda _: None,
        stderr=lambda _: None,
    )
    assert activate_exit == 0
    with session_factory() as verify_db:
        activated = verify_db.execute(select(AdminUser).where(AdminUser.username == "ops-admin")).scalar_one()
        assert activated.is_active is True


def test_admin_cli_rejects_short_password(monkeypatch, tmp_path):
    _bind_cli_to_temp_db(monkeypatch, tmp_path)
    prompts = iter(["short", "short"])
    stderr: list[str] = []

    exit_code = admin_cli.main(
        ["reset-password", "--username", "admin"],
        password_prompt=lambda _: next(prompts),
        stdout=lambda _: None,
        stderr=_capture_output(stderr),
    )

    assert exit_code == 1
    assert stderr == ["Password must be at least 8 characters long."]

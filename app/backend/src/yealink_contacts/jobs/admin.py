from __future__ import annotations

import argparse
from collections.abc import Callable, Sequence
from dataclasses import dataclass
import getpass
import sys

from sqlalchemy.exc import IntegrityError

import yealink_contacts.models  # noqa: F401
from yealink_contacts.db.session import SessionLocal, init_db
from yealink_contacts.services.auth_service import (
    create_admin_user,
    get_admin_user_by_username_any_state,
    list_admin_users,
    seed_bootstrap_admin,
    set_admin_active_state,
    set_admin_password,
)

PasswordPrompt = Callable[[str], str]
OutputWriter = Callable[[str], None]

MIN_PASSWORD_LENGTH = 8


@dataclass(frozen=True)
class CommandContext:
    password_prompt: PasswordPrompt
    stdout: OutputWriter
    stderr: OutputWriter


def _print_user_table(context: CommandContext) -> int:
    with SessionLocal() as db:
        users = list_admin_users(db)

    if not users:
        context.stdout("No admin users found.")
        return 0

    for user in users:
        last_login = user.last_login_at.isoformat() if user.last_login_at else "never"
        context.stdout(
            f"{user.username}\tactive={user.is_active}\tmust_change_password={user.must_change_password}"
            f"\tpasskeys={len(user.passkeys)}\tlast_login={last_login}"
        )
    return 0


def _prompt_for_password(
    context: CommandContext,
    *,
    confirm: bool = True,
) -> str:
    password = context.password_prompt("New password: ")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.")
    if not confirm:
        return password

    confirmation = context.password_prompt("Confirm new password: ")
    if password != confirmation:
        raise ValueError("Passwords do not match.")
    return password


def _reset_password(args: argparse.Namespace, context: CommandContext) -> int:
    with SessionLocal() as db:
        admin_user = get_admin_user_by_username_any_state(db, args.username)
        if admin_user is None:
            context.stderr(f"Admin user '{args.username}' not found.")
            return 1

        password = _prompt_for_password(context)
        updated = set_admin_password(
            db,
            admin_user,
            password,
            must_change_password=args.must_change_password,
        )

    context.stdout(
        f"Password reset for '{updated.username}'. must_change_password={updated.must_change_password}"
    )
    return 0


def _create_user(args: argparse.Namespace, context: CommandContext) -> int:
    with SessionLocal() as db:
        if get_admin_user_by_username_any_state(db, args.username) is not None:
            context.stderr(f"Admin user '{args.username}' already exists.")
            return 1

        password = _prompt_for_password(context)
        try:
            created = create_admin_user(
                db,
                args.username,
                password,
                must_change_password=not args.no_must_change_password,
            )
        except IntegrityError:
            db.rollback()
            context.stderr(f"Failed to create admin user '{args.username}' because the username already exists.")
            return 1

    context.stdout(
        f"Created admin user '{created.username}'. must_change_password={created.must_change_password}"
    )
    return 0


def _set_active_state(args: argparse.Namespace, context: CommandContext, *, is_active: bool) -> int:
    with SessionLocal() as db:
        admin_user = get_admin_user_by_username_any_state(db, args.username)
        if admin_user is None:
            context.stderr(f"Admin user '{args.username}' not found.")
            return 1
        if admin_user.is_active == is_active:
            context.stdout(
                f"Admin user '{admin_user.username}' is already {'active' if is_active else 'inactive'}."
            )
            return 0
        updated = set_admin_active_state(db, admin_user, is_active=is_active)

    context.stdout(f"Admin user '{updated.username}' active={updated.is_active}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m yealink_contacts.jobs.admin",
        description="Local-only administrative utilities for Yealink Contacts Sync.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list-users", help="List admin users and their current status.")

    reset_parser = subparsers.add_parser("reset-password", help="Reset an admin user's password.")
    reset_parser.add_argument("--username", required=True, help="Admin username to update.")
    reset_parser.add_argument(
        "--must-change-password",
        action="store_true",
        help="Require the user to change the password on the next login.",
    )

    create_parser = subparsers.add_parser("create-user", help="Create a new admin user.")
    create_parser.add_argument("--username", required=True, help="Admin username to create.")
    create_parser.add_argument(
        "--no-must-change-password",
        action="store_true",
        help="Skip the forced password change on first login for the new user.",
    )

    deactivate_parser = subparsers.add_parser("deactivate-user", help="Deactivate an admin user.")
    deactivate_parser.add_argument("--username", required=True, help="Admin username to deactivate.")

    activate_parser = subparsers.add_parser("activate-user", help="Activate an admin user.")
    activate_parser.add_argument("--username", required=True, help="Admin username to activate.")

    return parser


def main(
    argv: Sequence[str] | None = None,
    *,
    password_prompt: PasswordPrompt | None = None,
    stdout: OutputWriter | None = None,
    stderr: OutputWriter | None = None,
) -> int:
    init_db()
    with SessionLocal() as db:
        try:
            seed_bootstrap_admin(db)
        except IntegrityError:
            db.rollback()
    parser = build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)
    context = CommandContext(
        password_prompt=password_prompt or getpass.getpass,
        stdout=stdout or print,
        stderr=stderr or (lambda message: print(message, file=sys.stderr)),
    )

    try:
        if args.command == "list-users":
            return _print_user_table(context)
        if args.command == "reset-password":
            return _reset_password(args, context)
        if args.command == "create-user":
            return _create_user(args, context)
        if args.command == "deactivate-user":
            return _set_active_state(args, context, is_active=False)
        if args.command == "activate-user":
            return _set_active_state(args, context, is_active=True)
    except ValueError as exc:
        context.stderr(str(exc))
        return 1

    context.stderr(f"Unsupported command: {args.command}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

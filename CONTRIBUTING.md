# Contributing

## Development setup

1. Copy `.env.example` to `.env`.
2. Install backend dependencies in `app/backend`.
3. Install frontend dependencies in `app/frontend`.
4. Install the git hooks with `make hooks-install`.
5. Run tests before opening a pull request.

The repository uses `prek` with a `pre-push` hook. Every push runs a Docker smoke check that:

- builds the backend and frontend images
- starts the stack with temporary local images
- waits for backend and frontend health checks to succeed

If the Docker stack does not build or start cleanly, the push is rejected.

## Pull requests

- Keep changes scoped and explain the user-facing impact.
- Add or update tests for behavior changes.
- Update documentation when setup, configuration, or deployment changes.
- Prefer semantic commit messages where practical.

## Versioning

This project follows Semantic Versioning.

- Create release tags as `vMAJOR.MINOR.PATCH`
- Examples: `v0.2.0`, `v1.0.0`

The release workflow derives the published application version from the Git tag.

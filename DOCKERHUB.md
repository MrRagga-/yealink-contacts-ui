# Yealink Contacts Sync

Yealink Contacts Sync is a local-first contact synchronization tool with a FastAPI backend and a React admin UI. It imports contacts from Google Contacts and CardDAV sources, normalizes and filters them, previews the result, and publishes Yealink Remote Phonebook XML endpoints.

## Published Images

This Docker Hub repository publishes two images through tag prefixes:

- `docker.io/mrragga/yealink-contacts-ui:backend-latest`
- `docker.io/mrragga/yealink-contacts-ui:frontend-latest`
- `docker.io/mrragga/yealink-contacts-ui:backend-vX.Y.Z`
- `docker.io/mrragga/yealink-contacts-ui:frontend-vX.Y.Z`

Pull examples:

```bash
docker pull docker.io/mrragga/yealink-contacts-ui:backend-latest
docker pull docker.io/mrragga/yealink-contacts-ui:frontend-latest
```

## What It Does

- Imports contacts from Google Contacts and CardDAV or Nextcloud CardDAV sources.
- Stores contacts in a canonical internal model with normalized phone numbers.
- Applies export rules for source filtering, number selection, prioritization, and name mapping.
- Previews exported vs. discarded contacts before publishing.
- Serves Yealink Remote Phonebook XML over HTTP for direct phone provisioning.

## Runtime Notes

- The backend image serves the FastAPI API and Yealink XML endpoints.
- The frontend image serves the React admin UI through Nginx.
- The standard local deployment is a multi-container setup with PostgreSQL or SQLite for development.

Typical endpoints in a deployment:

- Frontend UI: `http://<host>:5173`
- Backend API: `http://<host>:8000/docs`
- Yealink XML: `http://<host>:8000/api/yealink/phonebook/<profile>.xml`

## Compose Files

Use the repository `docker-compose.yml` to run the published Docker Hub images:

```bash
cp .env.example .env
docker compose up
```

Use `docker-compose.dev.yml` when you want to build the backend and frontend images from the local checkout instead:

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
```

## Project Source

- GitHub: [MrRagga-/yealink-contacts-ui](https://github.com/MrRagga-/yealink-contacts-ui)

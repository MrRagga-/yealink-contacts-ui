#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="yealink-prepush-${USER:-user}-$$"
BACKEND_IMAGE="yealink-prepush-backend:${USER:-user}-$RANDOM"
FRONTEND_IMAGE="yealink-prepush-frontend:${USER:-user}-$RANDOM"
STANDALONE_FRONTEND="yealink-prepush-frontend-standalone-${USER:-user}-$$"
TEMP_ENV_CREATED=0

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
else
  echo "A Python interpreter is required for the Docker smoke check." >&2
  exit 1
fi

cleanup() {
  local status=$1

  if [ $status -ne 0 ]; then
    echo "Docker smoke check failed. Container status and recent logs:" >&2
    (
      cd "$ROOT_DIR"
      BACKEND_IMAGE="$BACKEND_IMAGE" \
      FRONTEND_IMAGE="$FRONTEND_IMAGE" \
      DB_PORT="${DB_PORT:-5432}" \
      BACKEND_PORT="${BACKEND_PORT:-8000}" \
      FRONTEND_PORT="${FRONTEND_PORT:-5173}" \
      docker compose -p "$PROJECT" ps -a
    ) >&2 || true
    (
      cd "$ROOT_DIR"
      BACKEND_IMAGE="$BACKEND_IMAGE" \
      FRONTEND_IMAGE="$FRONTEND_IMAGE" \
      DB_PORT="${DB_PORT:-5432}" \
      BACKEND_PORT="${BACKEND_PORT:-8000}" \
      FRONTEND_PORT="${FRONTEND_PORT:-5173}" \
      docker compose -p "$PROJECT" logs --tail=200
    ) >&2 || true
  fi

  (
    cd "$ROOT_DIR"
    BACKEND_IMAGE="$BACKEND_IMAGE" \
    FRONTEND_IMAGE="$FRONTEND_IMAGE" \
    DB_PORT="${DB_PORT:-5432}" \
    BACKEND_PORT="${BACKEND_PORT:-8000}" \
    FRONTEND_PORT="${FRONTEND_PORT:-5173}" \
    docker compose -p "$PROJECT" down -v --remove-orphans
  ) >/dev/null 2>&1 || true

  docker rm -f "$STANDALONE_FRONTEND" >/dev/null 2>&1 || true

  if [ "$TEMP_ENV_CREATED" -eq 1 ]; then
    rm -f "$ROOT_DIR/.env"
  fi
}

trap 'status=$?; cleanup "$status"; exit "$status"' EXIT

pick_port() {
  "$PYTHON_BIN" - <<'PY'
import socket

with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    print(sock.getsockname()[1])
PY
}

wait_for_url() {
  local name=$1
  local url=$2

  "$PYTHON_BIN" - "$name" "$url" <<'PY'
import sys
import time
import urllib.request

name = sys.argv[1]
url = sys.argv[2]
last_error = None

for _ in range(30):
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            body = response.read(200).decode("utf-8", "replace").strip()
            print(f"{name}: {response.status} {body}")
            sys.exit(0)
    except Exception as exc:
        last_error = exc
        time.sleep(1)

print(f"{name}: FAIL {last_error}", file=sys.stderr)
sys.exit(1)
PY
}

cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for the Docker smoke check." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not available." >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  TEMP_ENV_CREATED=1
  echo "No .env found. Created a temporary .env from .env.example for the smoke check."
fi

DB_PORT="$(pick_port)"
BACKEND_PORT="$(pick_port)"
FRONTEND_PORT="$(pick_port)"

echo "Building backend image..."
docker build -f app/backend/Dockerfile -t "$BACKEND_IMAGE" .

echo "Building frontend image..."
docker build -f app/frontend/Dockerfile -t "$FRONTEND_IMAGE" .

echo "Starting standalone frontend image to verify nginx boots..."
docker run -d --name "$STANDALONE_FRONTEND" -e BACKEND_UPSTREAM=127.0.0.1:8000 -p 127.0.0.1::80 "$FRONTEND_IMAGE" >/dev/null
sleep 2
if [ "$(docker inspect -f '{{.State.Running}}' "$STANDALONE_FRONTEND")" != "true" ]; then
  echo "Standalone frontend container exited unexpectedly." >&2
  docker logs "$STANDALONE_FRONTEND" >&2 || true
  exit 1
fi
FRONTEND_STANDALONE_PORT="$(docker port "$STANDALONE_FRONTEND" 80/tcp | sed 's/.*://')"
wait_for_url "frontend-standalone" "http://127.0.0.1:$FRONTEND_STANDALONE_PORT/frontend-healthz"
docker rm -f "$STANDALONE_FRONTEND" >/dev/null

echo "Starting smoke-test stack on ports db=$DB_PORT backend=$BACKEND_PORT frontend=$FRONTEND_PORT..."
BACKEND_IMAGE="$BACKEND_IMAGE" \
FRONTEND_IMAGE="$FRONTEND_IMAGE" \
DB_PORT="$DB_PORT" \
BACKEND_PORT="$BACKEND_PORT" \
FRONTEND_PORT="$FRONTEND_PORT" \
docker compose -p "$PROJECT" up -d

wait_for_url "backend" "http://127.0.0.1:$BACKEND_PORT/healthz"
wait_for_url "frontend-proxy" "http://127.0.0.1:$FRONTEND_PORT/healthz"
wait_for_url "frontend-index" "http://127.0.0.1:$FRONTEND_PORT/"

echo "Verifying frontend API proxy preserves auth routes..."
"$PYTHON_BIN" - "$FRONTEND_PORT" <<'PY'
import json
import sys
import urllib.error
import urllib.request

port = sys.argv[1]
request = urllib.request.Request(
    f"http://127.0.0.1:{port}/api/auth/login",
    data=json.dumps({"username": "nope", "password": "wrong"}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)

try:
    with urllib.request.urlopen(request, timeout=5) as response:
        body = response.read().decode("utf-8", "replace")
        print(f"frontend-login-proxy: unexpected success {response.status} {body}", file=sys.stderr)
        sys.exit(1)
except urllib.error.HTTPError as exc:
    payload = exc.read().decode("utf-8", "replace")
    print(f"frontend-login-proxy: {exc.code} {payload}")
    if exc.code != 401 or "Invalid username or password." not in payload:
        sys.exit(1)
PY

echo "Docker smoke check passed."

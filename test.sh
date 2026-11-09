#!/bin/sh
# Runs every automated check in Docker, the same way CI does:
#   backend: migrations on a fresh database, then all API tests
#   frontend: lint, unit tests, and a production build
set -e
# Remove only the throwaway test database; development containers and data are left alone.
cleanup() { docker compose --profile test rm --stop --force test-database >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> Backend tests"
docker compose --profile test run --rm --build backend-test

echo "==> Frontend checks"
docker compose --profile test run --rm --build frontend-test

echo "All checks passed."
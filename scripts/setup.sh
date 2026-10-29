#!/bin/sh
# First installation only. Existing installations should use update.sh.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
project="${COMPOSE_PROJECT_NAME:-homehero}"
test -f .env || { echo 'Copy .env.example to .env and configure it first.' >&2; exit 1; }
docker compose config --quiet
docker compose build web notification-worker maintenance
docker compose up -d --wait postgres redis
mkdir -p minio
docker compose run --rm --no-deps --name "$project-maintenance" -v "$PWD/minio:/storage" maintenance sh -c 'chown 65532:65532 /storage && chmod 700 /storage && npm run prisma:deploy && npm run create:admin'
docker compose up -d --wait minio
docker compose run --rm --no-deps --name "$project-storage-setup" storage-setup
docker compose up -d --no-build --wait web notification-worker
echo 'HomeHero is ready. Open /en/admin to sign in.'

#!/bin/sh
# Back up the database and document storage before updating.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
project="${COMPOSE_PROJECT_NAME:-homehero}"
docker compose config --quiet
docker compose build web notification-worker maintenance
docker compose up -d --wait postgres redis minio
docker compose run --rm --no-deps --name "$project-maintenance" maintenance
docker compose up -d --no-build --wait web notification-worker
echo 'HomeHero update completed.'

#!/bin/sh
set -eu
attempt=0
until /usr/bin/mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo 'Storage did not become ready; check the MinIO service and credentials.' >&2
    exit 1
  fi
  sleep 2
done
/usr/bin/mc mb --ignore-existing "local/$S3_BUCKET"
/usr/bin/mc anonymous set none "local/$S3_BUCKET"
echo 'Private document storage is ready.'

#!/bin/sh
# DESTRUCTIVE: local test database only. Never run against a live database.
set -eu
if [ "${1:-}" = "" ]; then echo 'Usage: scripts/restore-local.sh backups/file.dump' >&2; exit 2; fi
if [ "${CONFIRM_LOCAL_RESTORE:-}" != "YES" ]; then echo 'Set CONFIRM_LOCAL_RESTORE=YES to confirm destructive local restore' >&2; exit 2; fi
docker compose exec -T db sh -c 'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "$1"

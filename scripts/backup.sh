#!/bin/sh
# Local development backup. Store and encrypt backups securely for real deployments.
set -eu
mkdir -p backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker compose exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "backups/easyshopdrop-$stamp.dump"
echo "Created backups/easyshopdrop-$stamp.dump"

#!/usr/bin/env sh
set -eu
out="${1:-backups/library-$(date +%Y%m%d-%H%M%S).dump}"
mkdir -p "$(dirname "$out")"
docker compose exec -T postgres pg_dump -Fc -U library_admin -d library > "$out"
echo "Backup written to $out"

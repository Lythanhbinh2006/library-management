#!/usr/bin/env sh
set -eu
[ "$#" -eq 1 ] || { echo "Usage: $0 backup.dump" >&2; exit 2; }
printf 'Restore will replace current library data. Type RESTORE to continue: '
read answer
[ "$answer" = RESTORE ] || { echo 'Cancelled.'; exit 1; }
docker compose exec -T postgres pg_restore --clean --if-exists --no-owner -U library_admin -d library < "$1"

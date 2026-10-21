#!/usr/bin/env sh
set -eu
for file in db/migrations/*.sql; do
  [ -f "$file" ] || continue
  echo "Applying $file"
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U library_admin -d library < "$file"
done
echo "Migrations complete."

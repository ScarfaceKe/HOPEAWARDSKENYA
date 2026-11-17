#!/usr/bin/env bash
#
# Restore a dump produced by scripts/db-export.sh into a replacement database.
#
#   TARGET_DATABASE_URL='postgresql://…' sh ./scripts/db-restore.sh backups/hopeawards-….dump
#
# Safety:
#   * refuses to run without TARGET_DATABASE_URL
#   * refuses to target the same database as DATABASE_URL (never restore over
#     production Neon — it is the rollback)
#   * --single-transaction + --exit-on-error: either the whole dump lands or the
#     target is left untouched
set -euo pipefail

if [ -z "${TARGET_DATABASE_URL:-}" ]; then
  echo "TARGET_DATABASE_URL is not set. Export the replacement connection string first." >&2
  exit 1
fi

DUMP="${1:-}"
if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "Usage: TARGET_DATABASE_URL=… sh ./scripts/db-restore.sh <dumpfile>" >&2
  exit 1
fi

if [ -n "${DATABASE_URL:-}" ] && [ "$DATABASE_URL" = "$TARGET_DATABASE_URL" ]; then
  echo "Refusing to restore over DATABASE_URL. Point TARGET_DATABASE_URL at the new database." >&2
  exit 1
fi

echo "[restore] Checking the dump is readable"
pg_restore --list "$DUMP" >/dev/null

echo "[restore] Restoring into the target database"
pg_restore \
  --dbname="$TARGET_DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --exit-on-error \
  "$DUMP"

echo "[restore] Restore complete. Now verify before touching Render:"
echo "  psql \"\\$TARGET_DATABASE_URL\" -f scripts/db-verify.sql > target.txt"
echo "  psql \"\\$DATABASE_URL\"        -f scripts/db-verify.sql > source.txt"
echo "  diff source.txt target.txt   # must be empty"

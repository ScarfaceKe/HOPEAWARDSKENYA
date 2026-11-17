#!/usr/bin/env bash
#
# Consistent logical backup of the Hope Awards database.
#
#   DATABASE_URL='postgresql://…' sh ./scripts/db-export.sh [output-dir]
#
# Writes one custom-format dump and proves it is readable before exiting, so a
# failed backup can never be mistaken for a good one. Never commit the output:
# `backups/` and `*.dump` are git-ignored because the dump contains voters'
# phone numbers.
#
# Point DATABASE_URL at production Neon. Take TWO copies before a cutover and
# keep one off this machine.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Export the source connection string first." >&2
  exit 1
fi

command -v pg_dump >/dev/null 2>&1 || {
  echo "pg_dump is not installed. Use a machine with PostgreSQL client tools 16+." >&2
  exit 1
}

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/hopeawards-$STAMP.dump"

echo "[export] Dumping the database to $FILE"
# --format=custom keeps everything (data, indexes, sequences, constraints) in a
# single portable file. --no-owner/--no-privileges make it restorable into a
# Supabase role that does not own the objects Neon's role owned.
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --lock-wait-timeout=30s \
  --file="$FILE"

echo "[export] Verifying the dump is readable"
pg_restore --list "$FILE" >/dev/null

SIZE="$(du -h "$FILE" | cut -f1)"
echo "[export] OK: $FILE ($SIZE)"
echo "[export] Copy this file somewhere off this machine before any restore."

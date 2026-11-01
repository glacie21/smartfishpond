#!/bin/sh
# ============================================================
#  Backup manual database dari container postgres ke ./backups.
#
#  Pemakaian (dari root repo; di Windows lewat Git Bash/WSL):
#      npm run backup
#      sh scripts/backup-db.sh /path/ke/folder-backup
#
#  Hasil: <db>-<waktu UTC>.dump (format custom pg_dump, terkompresi).
#  Untuk backup terjadwal di produksi, pakai layanan db-backup di
#  docker-compose.prod.yml.
# ============================================================
set -eu

BACKUP_DIR=${1:-./backups}
mkdir -p "$BACKUP_DIR"

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TMP="$BACKUP_DIR/.backup-$STAMP.partial"

# POSTGRES_USER/POSTGRES_DB dibaca dari env container, sama dengan saat dibuat.
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' </dev/null > "$TMP"

DB=$(docker compose exec -T postgres sh -c 'printf %s "$POSTGRES_DB"' </dev/null)
FILE="$BACKUP_DIR/$DB-$STAMP.dump"
mv "$TMP" "$FILE"

echo "Backup tersimpan: $FILE ($(du -h "$FILE" | cut -f1))"

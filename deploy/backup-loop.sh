#!/bin/sh
# ============================================================
#  Backup PostgreSQL berkala (layanan db-backup di docker-compose.prod.yml).
#
#  Tiap BACKUP_INTERVAL_HOURS jam: pg_dump format custom ke /backups, lalu
#  hapus backup yang lebih tua dari BACKUP_RETENTION_DAYS hari.
#  Koneksi memakai env standar libpq: PGHOST, PGUSER, PGPASSWORD, PGDATABASE.
#  Restore: scripts/restore-db.sh <file.dump>
# ============================================================
set -eu

INTERVAL_SECONDS=$((${BACKUP_INTERVAL_HOURS:-24} * 3600))
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}

echo "[backup] tiap ${BACKUP_INTERVAL_HOURS:-24} jam, simpan ${RETENTION_DAYS} hari, database ${PGDATABASE}"

while true; do
  FILE="/backups/${PGDATABASE}-$(date -u +%Y%m%dT%H%M%SZ).dump"

  # Tulis ke .partial dulu agar backup yang terputus tidak dikira utuh.
  if pg_dump --format=custom --file="${FILE}.partial"; then
    mv "${FILE}.partial" "$FILE"
    echo "[backup] $(date -u +%FT%TZ) tersimpan: $(basename "$FILE") ($(du -h "$FILE" | cut -f1))"
  else
    rm -f "${FILE}.partial"
    echo "[backup] $(date -u +%FT%TZ) GAGAL, dicoba lagi pada jadwal berikutnya" >&2
  fi

  find /backups -name "${PGDATABASE}-*.dump" -type f -mtime +"$RETENTION_DAYS" -print -delete \
    | sed 's/^/[backup] dihapus (melewati retensi): /'

  sleep "$INTERVAL_SECONDS"
done

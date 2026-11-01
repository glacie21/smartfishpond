#!/bin/sh
# ============================================================
#  Pulihkan database dari file backup (.dump hasil pg_dump --format=custom).
#
#  Pemakaian (dari root repo):
#      npm run restore -- backups/smartfishpond-20261101T020000Z.dump
#
#  PERINGATAN: seluruh isi database saat ini DIGANTI isi backup.
#  Backend dihentikan selama restore agar tidak ada data yang masuk di tengah.
# ============================================================
set -eu

FILE=${1:-}
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Pemakaian: sh scripts/restore-db.sh <file.dump>" >&2
  exit 1
fi

DB=$(docker compose exec -T postgres sh -c 'printf %s "$POSTGRES_DB"')
echo "Database \"$DB\" akan DIGANTI dengan isi $FILE."
printf 'Ketik nama database untuk melanjutkan: '
read -r CONFIRM
if [ "$CONFIRM" != "$DB" ]; then
  echo "Dibatalkan." >&2
  exit 1
fi

# Hentikan backend bila sedang berjalan (profil full); abaikan bila tidak ada.
BACKEND_WAS_RUNNING=$(docker compose ps --status running --services 2>/dev/null | grep -x backend || true)
if [ -n "$BACKEND_WAS_RUNNING" ]; then
  echo "Menghentikan backend..."
  docker compose stop backend
fi

echo "Memulihkan..."
# --clean --if-exists: hapus objek lama dulu; --single-transaction: semua atau tidak sama sekali.
docker compose exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction' < "$FILE"

if [ -n "$BACKEND_WAS_RUNNING" ]; then
  echo "Menyalakan kembali backend..."
  docker compose start backend
fi

echo "Restore selesai."

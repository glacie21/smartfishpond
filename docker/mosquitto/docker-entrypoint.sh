#!/bin/sh
# ============================================================
#  Menyiapkan konfigurasi Mosquitto sebelum broker berjalan:
#    1. Menyalin mosquitto.conf dan acl dari /mosquitto/setup
#    2. Menyusun password_file dari env + docker/mosquitto/credentials
#    3. Meng-hash seluruh password dengan mosquitto_passwd -U
#  lalu menyerahkan ke entrypoint bawaan image.
# ============================================================
set -eu

SETUP=/mosquitto/setup
CONF=/mosquitto/config
PASSWD="$CONF/passwd"

if [ -z "${MQTT_BACKEND_PASSWORD:-}" ]; then
  echo "[mosquitto] MQTT_BACKEND_PASSWORD kosong. Isi di .env root (lihat .env.example)." >&2
  exit 1
fi

cp "$SETUP/mosquitto.conf" "$CONF/mosquitto.conf"
cp "$SETUP/acl" "$CONF/acl"

: > "$PASSWD"
printf '%s\n' "fishpond-backend:$MQTT_BACKEND_PASSWORD" >> "$PASSWD"

if [ -n "${MQTT_SIMULATOR_PASSWORD:-}" ]; then
  printf '%s\n' "fishpond-simulator:$MQTT_SIMULATOR_PASSWORD" >> "$PASSWD"
  echo "[mosquitto] akun fishpond-simulator aktif (development)"
fi

if [ -f "$SETUP/credentials" ]; then
  # Buang komentar, baris kosong, dan CR dari file yang diedit di Windows.
  tr -d '\r' < "$SETUP/credentials" | grep -v '^[[:space:]]*#' | grep -v '^[[:space:]]*$' >> "$PASSWD" || true
else
  echo "[mosquitto] docker/mosquitto/credentials tidak ada: belum ada device yang bisa login" >&2
fi

mosquitto_passwd -U "$PASSWD"
echo "[mosquitto] $(wc -l < "$PASSWD") akun MQTT disiapkan"

# Mosquitto menolak (versi mendatang) file password/ACL yang bisa dibaca semua user.
chown mosquitto:mosquitto "$PASSWD" "$CONF/acl"
chmod 0700 "$PASSWD" "$CONF/acl"

exec /docker-entrypoint.sh "$@"

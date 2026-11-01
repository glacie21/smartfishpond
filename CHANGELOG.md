# Changelog

Semua perubahan penting pada proyek ini dicatat di sini.
Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
dan proyek ini memakai [Semantic Versioning](https://semver.org/lang/id/).

## [Unreleased]

### Ditambahkan

- **Keamanan:** login JWT dengan peran `admin`/`viewer`, halaman login di
  dashboard, CLI `npm run user:create`, rate limit API dan percobaan login,
  autentikasi Socket.IO.
- **Broker MQTT:** koneksi anonim ditolak, password per device, ACL per
  device (username = deviceId), dukungan TLS opsional di firmware.
- **Alert:** ambang batas per kolam yang bisa diatur admin, alert parameter
  air (dengan debounce & hysteresis) dan device offline, notifikasi Telegram,
  halaman Alert dan lencana di menu.
- **Kendali aktuator:** aerator, pompa, dan feeder dari dashboard dengan
  konfirmasi device, auto-off, dan log perintah.
- **Kelola device:** daftarkan, ubah nama/kolam, dan hapus device dari
  dashboard.
- **OTA:** update firmware lewat WiFi (ArduinoOTA berpassword).
- **Rollup per jam** `readings_hourly`: grafik rentang panjang lebih ringan
  dan riwayat tetap tersedia setelah data mentah melewati retensi
  (`HOURLY_RETENTION_DAYS`).
- **Testing:** test komponen frontend, test integrasi backend terhadap
  PostgreSQL, unit test firmware di host (`pio test -e native`).
- **CI:** lint, test frontend, test integrasi dengan PostgreSQL, test
  firmware, dan validasi Docker Compose.
- **Operasional:** stack produksi dengan Caddy (HTTPS otomatis), backup
  database terjadwal + skrip backup/restore, endpoint metrik Prometheus,
  healthcheck container, panduan [docs/operations.md](docs/operations.md).
- Manifest PWA, favicon, dan `robots.txt` untuk dashboard.
- `CONTRIBUTING.md` dan changelog ini.

### Diubah

- Device kini **terkunci ke kolam terdaftarnya**: pesan MQTT yang topiknya
  menyebut kolam lain ditolak. Pindah kolam lewat dashboard, lalu ganti
  `POND_ID` di firmware.
- Identitas device diambil dari topik MQTT; payload yang mengaku sebagai
  device lain ditolak.
- Aerator **menyala saat ESP32 boot** (aman setelah listrik padam); bisa
  diubah lewat `AERATOR_ON_AT_BOOT`.
- Kartu metrik dan grafik dashboard memakai ambang dari server, sama dengan
  evaluasi alert.
- Container backend berjalan sebagai user non-root.
- ESLint memakai aturan rekomendasi + plugin React/hooks.

### Dihapus

- Materialized view `hourly_readings` (diganti tabel `readings_hourly`).
- `postcss.config.mjs` kosong di backend dan frontend.

### Diperbaiki

- Status aktuator yang tiba sebelum pesan status pertama device tidak lagi
  hilang.
- `npm run user:create -- <username>` tanpa `--role` kini berfungsi.
- Event device offline dari tugas latar kini sampai ke halaman kolam.

### Migrasi dari versi sebelumnya

1. Salin ulang `.env.example`; isi `JWT_SECRET`, `MQTT_BACKEND_PASSWORD`,
   dan (development) `MQTT_SIMULATOR_PASSWORD`.
2. Buat `docker/mosquitto/credentials` dari contohnya, lalu
   `docker compose restart mosquitto`.
3. `npm run migrate`, lalu buat akun admin: `npm run user:create -- admin --role admin`.
4. Flash ulang firmware dengan `MQTT_USERNAME`/`MQTT_PASSWORD` baru di `secrets.h`.

## [0.1.0]

Rilis awal: firmware ESP32 enam sensor, ingest MQTT, REST API, dashboard
realtime, simulator device, dan Docker Compose untuk pengembangan.

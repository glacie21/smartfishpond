# Operasional: Deploy, Backup, dan Monitoring

Panduan menjalankan Smart Fish Pond di server sungguhan. Untuk pengembangan
lokal, cukup ikuti [README](../README.md#-cara-menjalankan).

## Daftar isi

- [Deploy ke produksi](#deploy-ke-produksi)
- [Update versi](#update-versi)
- [Backup & restore](#backup--restore)
- [Monitoring](#monitoring)
- [Rotasi kredensial](#rotasi-kredensial)
- [Pemecahan masalah](#pemecahan-masalah)

---

## Deploy ke produksi

### Arsitektur

```
Internet ──443/80──► Caddy (HTTPS otomatis) ──► frontend (nginx, dashboard)
                          │
                          └── /api, /socket.io ──► backend ──► PostgreSQL
ESP32 ─────1883/8883─────► Mosquitto ──────────────► backend
```

Hanya Caddy (80/443) dan Mosquitto yang terbuka ke luar. PostgreSQL, backend,
dan frontend hanya bisa diakses di jaringan internal Docker.

### Kebutuhan

- Server Linux dengan Docker Engine + Compose v2.24 atau lebih baru
  (`docker compose version`). 1 vCPU / 1 GB RAM cukup untuk puluhan node.
- Domain (mis. `kolam.contoh.com`) dengan record DNS `A`/`AAAA` ke IP server.
- Port terbuka di firewall: `80` dan `443` (dashboard), `1883` atau `8883`
  (MQTT untuk device).

### Langkah

```bash
git clone https://github.com/glacie21/smartfishpond.git
cd smartfishpond

cp .env.example .env
cp docker/mosquitto/credentials.example docker/mosquitto/credentials
```

Isi `.env`, minimal:

| Variabel                  | Isi                                                          |
| ------------------------- | ------------------------------------------------------------ |
| `DOMAIN`                  | Domain dashboard, mis. `kolam.contoh.com`                    |
| `POSTGRES_PASSWORD`       | Password acak yang panjang                                   |
| `JWT_SECRET`              | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `MQTT_BACKEND_PASSWORD`   | Password acak                                                |
| `MQTT_SIMULATOR_PASSWORD` | **Kosongkan** — akun simulator tidak perlu ada di produksi   |
| `TELEGRAM_*`              | Opsional, untuk notifikasi alert                             |

Isi `docker/mosquitto/credentials` dengan satu baris per ESP32
(lihat [mqtt-topics.md](mqtt-topics.md#keamanan)). Lalu jalankan:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile full up -d --build
docker compose exec backend node src/cli/createUser.js admin --role admin
```

Buka `https://<DOMAIN>`. Sertifikat HTTPS dipasang Caddy otomatis pada request
pertama (butuh beberapa detik).

> **Tips:** buat alias agar tidak mengetik dua `-f` terus-menerus:
> `alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile full'`

### MQTT dengan TLS

Device yang terhubung lewat internet sebaiknya memakai TLS (port 8883) agar
password MQTT dan data tidak terkirim apa adanya. Langkahnya ada di
[mqtt-topics.md → TLS](mqtt-topics.md#tls-disarankan-bila-broker-diakses-dari-luar-jaringan-lokal);
setelah itu ganti pemetaan port mosquitto di `docker-compose.prod.yml` menjadi
`"8883:8883"`.

---

## Update versi

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile full up -d --build
```

Migrasi database berjalan otomatis setiap backend start dan hanya menjalankan
migrasi yang belum pernah diterapkan. **Ambil backup dulu** sebelum update
besar (`npm run backup`).

Firmware di-update lewat WiFi tanpa membongkar box: lihat
[hardware.md → OTA](hardware.md#update-firmware-lewat-wifi-ota).

---

## Backup & restore

### Otomatis

Layanan `db-backup` di `docker-compose.prod.yml` menjalankan `pg_dump` setiap
`BACKUP_INTERVAL_HOURS` (default 24 jam) ke `BACKUP_DIR` (default `./backups`)
dan menghapus backup yang lebih tua dari `BACKUP_RETENTION_DAYS` (default 14).

```bash
docker compose logs db-backup        # cek backup terakhir berhasil
ls -lh backups/
```

> Backup di disk yang sama dengan database tidak melindungi dari kerusakan
> disk atau server hilang. **Salin `backups/` ke tempat lain secara rutin**,
> mis. dengan `rclone` ke penyimpanan cloud atau `rsync` ke server lain.

### Manual

```bash
npm run backup                       # -> backups/smartfishpond-<waktu>.dump
sh scripts/backup-db.sh /mnt/usb     # ke folder lain
```

### Restore

```bash
npm run restore -- backups/smartfishpond-20261101T020000Z.dump
```

Skrip meminta konfirmasi (ketik nama database), menghentikan backend,
memulihkan dalam satu transaksi, lalu menyalakan backend lagi. **Seluruh isi
database diganti.**

Uji restore sesekali ke mesin lain — backup yang belum pernah dicoba
dipulihkan belum tentu bisa dipakai.

---

## Monitoring

### Health check

`GET /api/health` (publik) melaporkan status database dan broker; membalas
`503` bila database tidak terjangkau. Container backend memakainya sebagai
`HEALTHCHECK`, sehingga `docker compose ps` menampilkan `healthy`/`unhealthy`.

### Prometheus

Isi `METRICS_TOKEN` di `.env` lalu restart backend. Endpoint `GET /metrics`
hanya bisa diakses dari jaringan internal Docker — Caddy memblokirnya dari
internet. Contoh konfigurasi Prometheus yang berjalan di jaringan Compose yang
sama:

```yaml
scrape_configs:
  - job_name: smartfishpond
    authorization:
      credentials: <METRICS_TOKEN>
    static_configs:
      - targets: ['backend:4000']
```

Metrik utama:

| Metrik                                        | Arti                                                |
| --------------------------------------------- | --------------------------------------------------- |
| `fishpond_mqtt_connected`                     | 1 bila backend tersambung ke broker                 |
| `fishpond_readings_ingested_total`            | Pembacaan tersimpan (rate-nya = laju data masuk)    |
| `fishpond_mqtt_messages_total{kind,result}`   | Pesan MQTT per hasil: `ok`, `rejected`, `error`, `ignored` |
| `fishpond_devices{status}`                    | Jumlah device online/offline                        |
| `fishpond_alerts_open{severity}`              | Alert terbuka per severity                          |
| `fishpond_notifications_total{channel,result}`| Notifikasi terkirim/gagal                           |
| `fishpond_commands_total{status}`             | Perintah aktuator per hasil                         |
| `fishpond_http_request_duration_seconds`      | Latensi API per route                               |
| `fishpond_process_*`, `fishpond_nodejs_*`     | CPU, memori, event loop proses Node.js              |

Contoh aturan alert Prometheus:

```yaml
groups:
  - name: smartfishpond
    rules:
      - alert: BrokerTerputus
        expr: fishpond_mqtt_connected == 0
        for: 5m
      - alert: TidakAdaDataMasuk
        expr: rate(fishpond_readings_ingested_total[15m]) == 0
        for: 15m
      - alert: PesanMqttGagalDiproses
        expr: rate(fishpond_mqtt_messages_total{result="error"}[10m]) > 0
        for: 10m
      - alert: NotifikasiGagal
        expr: increase(fishpond_notifications_total{result="failed"}[1h]) > 0
```

`TidakAdaDataMasuk` menangkap kegagalan yang tidak terlihat dari alert kolam
biasa: bila backend tidak menerima apa pun, tidak ada reading yang bisa memicu
alert parameter air.

### Log

Semua layanan menulis ke stdout. `LOG_LEVEL=debug` di backend untuk detail
lebih banyak (health check dan scrape metrik hanya muncul di level `debug`).

```bash
docker compose logs -f backend mosquitto
```

---

## Rotasi kredensial

| Kredensial              | Cara mengganti                                             | Dampak                                      |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| Password user dashboard | `docker compose exec backend node src/cli/createUser.js <user> --role <peran>` | Token lama tetap berlaku sampai kedaluwarsa |
| `JWT_SECRET`            | Ganti di `.env`, `up -d backend`                            | Semua user harus login ulang                |
| Password MQTT device    | Ubah baris di `docker/mosquitto/credentials`, `restart mosquitto`, flash/OTA firmware dengan password baru | Device lama terputus sampai di-update |
| `MQTT_BACKEND_PASSWORD` | Ganti di `.env`, `up -d mosquitto backend`                  | Backend tersambung ulang otomatis            |
| `POSTGRES_PASSWORD`     | `ALTER USER ... PASSWORD` di database, lalu ganti `.env` dan `up -d` | Variabel env saja tidak mengubah password database yang sudah ada |

---

## Pemecahan masalah

| Gejala                                       | Periksa                                                     |
| -------------------------------------------- | ----------------------------------------------------------- |
| Caddy gagal memasang sertifikat              | DNS domain sudah mengarah ke server? Port 80 & 443 terbuka? `docker compose logs caddy` |
| Backend restart terus                        | `docker compose logs backend` — biasanya `JWT_SECRET` kosong/terlalu pendek atau database belum siap |
| Dashboard kosong, `fishpond_mqtt_connected 0`| `MQTT_BACKEND_PASSWORD` sama di `.env` dan yang dipakai mosquitto? `docker compose logs mosquitto` |
| Device tidak bisa login ke broker (`rc=5`)   | Username = `DEVICE_ID`, password cocok dengan `credentials`, broker sudah di-restart |
| Data device ditolak (`terdaftar di kolam ...`) | Device dipindah kolam di dashboard tetapi `POND_ID` di firmware belum diganti |
| Disk penuh                                   | Turunkan `RAW_RETENTION_DAYS` / `BACKUP_RETENTION_DAYS`; `du -sh backups/` |

# Arsitektur Sistem

## Gambaran umum

```
   Kolam                    Jaringan                     Server                    Pengguna
┌──────────┐            ┌──────────────┐        ┌────────────────────┐        ┌────────────┐
│  Sensor  │            │              │        │  Backend Node.js   │        │            │
│  6 kanal │──ADC/1W──►│    ESP32     │──MQTT──►│  ┌──────────────┐  │        │  Browser   │
└──────────┘            │  (firmware)  │  1883  │  │ MQTT handler │  │        │  (React)   │
                        └──────────────┘        │  └──────┬───────┘  │        │            │
                                                │         ▼          │        │            │
                                                │  ┌──────────────┐  │        │            │
                                                │  │   Service    │  │        │            │
                                                │  └──┬────────┬──┘  │        │            │
                                                │     ▼        ▼     │        │            │
                                                │  ┌─────┐  ┌──────┐ │        │            │
                                                │  │ SQL │  │Socket│─┼───WS──►│            │
                                                │  └──┬──┘  └──────┘ │        │            │
                                                │     │   REST ◄─────┼──HTTP──┤            │
                                                └─────┼──────────────┘        └────────────┘
                                                      ▼
                                                ┌──────────┐
                                                │PostgreSQL│
                                                └──────────┘
```

## Alur data

1. **Pembacaan** — ESP32 membaca enam sensor tiap 5 detik (`SAMPLE_INTERVAL_MS`)
   dan menyimpannya sebagai pembacaan terakhir.
2. **Publikasi** — tiap 30 detik (`PUBLISH_INTERVAL_MS`) pembacaan terakhir
   diserialisasi menjadi JSON dan diterbitkan ke
   `fishpond/<pondId>/<deviceId>/telemetry` dengan QoS 1.
3. **Ingest** — backend berlangganan `fishpond/+/+/telemetry`, mem-parse topik
   dan payload, memvalidasi dengan zod, lalu menyimpan satu baris ke tabel
   `readings`.
4. **Broadcast** — baris yang tersimpan langsung disiarkan ke room Socket.IO
   `pond:<pondId>`, sehingga dashboard yang sedang terbuka menerimanya dalam
   hitungan milidetik tanpa polling.
5. **Historis** — dashboard mengambil data lampau lewat REST
   (`/api/readings` atau `/api/readings/aggregate`).

## Keputusan desain

### Mengapa MQTT, bukan HTTP langsung dari device?

MQTT jauh lebih hemat pada jaringan yang tidak stabil: koneksi TCP dipakai
ulang untuk semua paket, header-nya kecil, dan **Last Will** memberi tahu
server saat device mati mendadak — sesuatu yang tidak dimiliki HTTP tanpa
mekanisme heartbeat tambahan.

### Mengapa telemetri divalidasi ulang di backend?

Sensor yang rusak atau kabel yang lepas menghasilkan angka ekstrem, bukan
error. `PLAUSIBLE_RANGE` mengubah nilai di luar akal (mis. pH 47) menjadi
`null`, agar satu kanal rusak tidak merusak skala grafik seluruh dashboard.
Metrik lain pada paket yang sama tetap tersimpan.

### Mengapa kolam & device dibuat otomatis?

Menambah node di lapangan tidak boleh menuntut pendaftaran manual lebih dulu.
`ensureExists` melakukan upsert saat paket pertama masuk; nama dan lokasi
dilengkapi belakangan lewat `PATCH /api/ponds/:id`.

### Mengapa ada dua mekanisme status offline?

**Last Will MQTT** menangani kasus umum (device mati, WiFi putus) secara
instan. Namun Last Will hilang bila broker sendiri yang restart — karena itu
`maintenanceService` menyapu device yang tidak mengirim apa pun selama
180 detik dan menandainya offline.

### Mengapa buffer offline ada di firmware?

Kolam sering berada di jangkauan WiFi yang buruk. Buffer melingkar 20 payload
menahan data selama gangguan singkat dan mengirimkannya begitu koneksi pulih
(`Telemetry::flushBuffer` dipanggil dari callback `connect` MQTT). Buffer penuh
membuang data terlama — melewatkan pembacaan lama lebih baik daripada
kehabisan RAM.

### Mengapa agregasi dihitung di database?

Menggambar 30 hari data mentah berarti ~86.000 titik per metrik. `date_bin`
memampatkannya di sisi PostgreSQL menjadi puluhan titik sebelum melintasi
jaringan. Untuk data yang sangat besar, materialized view `hourly_readings`
(migrasi 002) menyediakan hasil yang sudah dihitung sebelumnya.

## Struktur lapisan backend

```
routes/        Definisi endpoint dan middleware validasi
  └── controllers/   Membaca request, memanggil service, menyusun respons
        └── services/      Logika bisnis, validasi domain, broadcast
              └── repositories/   Query SQL (satu-satunya lapisan yang tahu skema)
                    └── db/pool.js
```

Aturannya: lapisan hanya boleh memanggil ke bawah. `mqtt/handlers.js` masuk
langsung ke lapisan service — ia adalah pintu masuk kedua di samping HTTP.

## Skema database

| Tabel      | Isi                                                  |
| ---------- | ---------------------------------------------------- |
| `ponds`    | Metadata kolam                                       |
| `devices`  | Node ESP32, status koneksi, sinyal, waktu terakhir aktif |
| `readings` | Telemetri mentah; satu baris = satu paket            |

View pendukung:

- `latest_readings` — pembacaan terbaru per device (`DISTINCT ON`)
- `hourly_readings` — materialized view agregasi per jam

Indeks utama `(pond_id, recorded_at DESC)` dan `(device_id, recorded_at DESC)`
mengikuti pola kueri dashboard yang selalu "data terbaru untuk satu kolam".

## Retensi data

Data mentah dihapus setelah `RAW_RETENTION_DAYS` (default 90 hari) oleh tugas
latar yang berjalan tiap 6 jam. Setel ke `0` untuk menonaktifkan. Untuk
menyimpan riwayat panjang, segarkan `hourly_readings` secara berkala sebelum
data mentahnya kedaluwarsa.

## Arah pengembangan lanjutan

Struktur repo sudah menyiapkan tempat untuk penambahan berikut:

- **Kontrol aktuator** — tambahkan topik `.../command`, subscribe di firmware,
  dan endpoint `POST /api/devices/:id/command` di backend.
- **Notifikasi** — rule engine ambang batas di `services/`, pengirim
  Telegram/WhatsApp di `services/notification/`.
- **Autentikasi** — middleware JWT di `middleware/auth.js`, tabel `users`
  dan relasi kepemilikan kolam.
- **Skala besar** — ganti PostgreSQL biasa dengan TimescaleDB (hypertable pada
  `readings`) bila jumlah node bertambah banyak.

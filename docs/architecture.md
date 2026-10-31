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
jaringan.

Bucket ≥ 1 jam (grafik 7 dan 30 hari) dibaca dari tabel rollup
`readings_hourly`, bukan dari data mentah:

- **Diperbarui bertahap** tiap 5 menit oleh `rollupHourly`. Jam yang dihitung
  ulang adalah jam dari reading baru sejak rollup terakhir (dilacak lewat
  `readings.id` di `rollup_state`, jadi data bertimestamp lampau ikut
  tertangkap) ditambah dua jam terakhir.
- **Akurat saat digabung** — menyimpan `sum` & `count` per metrik, bukan
  rata-rata, sehingga rata-rata 6 jam/1 hari tetap benar walau ada nilai null.
- **Selalu mutakhir** — jam berjalan dan satu jam sebelumnya dihitung langsung
  dari data mentah lalu digabung dengan rollup dalam satu kueri.
- **Bertahan melewati retensi** — riwayat panjang tetap ada setelah data mentah
  dihapus.

Migrasi 002 sempat memakai materialized view `hourly_readings`; view itu
dihitung ulang penuh dari data mentah, sehingga tidak bisa menyimpan riwayat
melewati retensi. Migrasi 006 menggantinya.

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
| `readings_hourly` | Rollup per jam per device (sum/count/min/max tiap metrik) |
| `rollup_state` | Penanda `readings.id` terakhir yang sudah di-rollup |
| `users`    | Akun dashboard dan perannya                          |
| `thresholds` | Rentang aman: default + override per kolam         |
| `alerts`   | Kejadian alert dari mulai sampai pulih               |
| `device_commands` | Log perintah aktuator dan hasilnya            |

View pendukung:

- `latest_readings` — pembacaan terbaru per device (`DISTINCT ON`)

Indeks utama `(pond_id, recorded_at DESC)` dan `(device_id, recorded_at DESC)`
mengikuti pola kueri dashboard yang selalu "data terbaru untuk satu kolam".

## Retensi data

Tugas latar tiap 6 jam menghapus:

| Data              | Variabel                | Default   |
| ----------------- | ----------------------- | --------- |
| `readings` mentah | `RAW_RETENTION_DAYS`    | 90 hari   |
| `readings_hourly` | `HOURLY_RETENTION_DAYS` | 730 hari  |

Setel ke `0` untuk menonaktifkan. Rollup selalu dijalankan sebelum data mentah
dihapus, dan penghapusan dibatalkan bila rollup gagal — data tidak pernah
hilang sebelum masuk `readings_hourly`. Rollup per jam berukuran sekitar 1/120
data mentah (interval publish 30 detik), sehingga murah disimpan bertahun-tahun.

## Alert

Setiap reading yang tersimpan dievaluasi `alertService` terhadap ambang kolam
(tabel `thresholds`: default + override per kolam). Alert disimpan sebagai
kejadian dengan awal dan akhir (`alerts.started_at` / `resolved_at`), paling
banyak satu alert terbuka per device-metrik (unique index parsial).

- **Debounce** — butuh `ALERT_CONFIRM_READINGS` pembacaan buruk berturut-turut;
  hitungannya di memori karena kehilangan saat restart hanya menunda alert.
- **Hysteresis** — pulih setelah nilai masuk rentang aman dengan margin 5%,
  di sisi tempat pelanggaran terjadi.
- **Offline** — tugas latar tiap 60 detik membuka alert untuk device yang
  offline lebih dari `ALERT_OFFLINE_DELAY_SECONDS`, sehingga reboot singkat
  tidak memicu notifikasi.

Notifikasi (`notificationService`) dikirim tanpa menahan proses ingest dan
tidak pernah melempar error: Telegram yang down tidak boleh menghentikan
penyimpanan data.

## Kontrol aktuator

```
Dashboard ──POST /devices/:id/commands──► backend ──.../command──► ESP32
    ▲                                        │                         │
    └──── command:updated / device:actuators ┴◄── .../ack, .../actuators
```

Setiap perintah dicatat di `device_commands` (audit siapa & kapan). Status
`sent` → `done`/`failed` dari ack device, atau `timeout` oleh tugas latar.
Auto-off (`durationS`) dijalankan firmware agar tetap berhenti walau koneksi
putus.

## Arah pengembangan lanjutan

- **Aturan otomatis** — mis. nyalakan aerator saat DO di bawah ambang, di
  firmware (tetap jalan saat offline) atau sebagai rule di backend.
- **Kanal notifikasi lain** — WhatsApp/email di `notificationService`.
- **OTA jarak jauh** — saat ini OTA hanya di jaringan lokal (ArduinoOTA); untuk
  device di lokasi lain, tambahkan HTTP OTA yang diperintah lewat `.../command`.
- **Kepemilikan kolam** — login JWT dan peran admin/viewer sudah ada
  (`middleware/auth.js`, tabel `users`); langkah berikutnya relasi user ↔ kolam
  agar tiap pengguna hanya melihat kolamnya sendiri.
- **Skala besar** — ganti PostgreSQL biasa dengan TimescaleDB (hypertable pada
  `readings`) bila jumlah node bertambah banyak.

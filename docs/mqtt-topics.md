# Skema Topik & Payload MQTT

Komunikasi device <-> server memakai MQTT. Backend berlangganan dengan QoS 1.

## Format topik

```
fishpond/<pondId>/<deviceId>/<kind>
```

| Bagian     | Contoh          | Keterangan                                   |
| ---------- | --------------- | -------------------------------------------- |
| `fishpond` | `fishpond`      | Prefix tetap (`MQTT_TOPIC_BASE` di firmware) |
| `pondId`   | `pond-01`       | Identitas kolam                              |
| `deviceId` | `esp32-node-01` | Identitas node, unik seluruh sistem          |
| `kind`     | `telemetry`     | Jenis pesan, lihat tabel di bawah            |

| `kind`      | Arah              | Retained | Isi                                  |
| ----------- | ----------------- | -------- | ------------------------------------ |
| `telemetry` | device → server   | tidak    | Pembacaan sensor                     |
| `status`    | device → server   | ya       | Online/offline (termasuk Last Will)  |
| `actuators` | device → server   | ya       | Status relay terkini                 |
| `ack`       | device → server   | tidak    | Balasan sebuah perintah              |
| `command`   | server → device   | tidak    | Perintah nyala/mati aktuator         |

Backend berlangganan dengan wildcard:

```
fishpond/+/+/telemetry
fishpond/+/+/status
fishpond/+/+/actuators
fishpond/+/+/ack
```

**Kunci kolam.** Device yang sudah terdaftar terikat pada kolamnya. Pesan
dengan `pondId` di topik yang berbeda dari kolam terdaftar device akan ditolak
backend. Pindahkan device lewat `PATCH /api/devices/:id`, lalu sesuaikan
`POND_ID` di firmware.

## `telemetry` — pembacaan sensor

Diterbitkan tiap `PUBLISH_INTERVAL_MS` (default 30 detik), QoS 1, tidak retained.

```json
{
  "deviceId": "esp32-node-01",
  "pondId": "pond-01",
  "uptime": 3600,
  "rssi": -62,
  "metrics": {
    "temperature": 28.4,
    "ph": 7.21,
    "tds": 312.5,
    "dissolvedOxygen": 6.84,
    "turbidity": 12.5,
    "waterLevel": 95.2
  }
}
```

| Field                     | Satuan | Wajib | Catatan                                        |
| ------------------------- | ------ | ----- | ---------------------------------------------- |
| `deviceId`                | —      | tidak | Diambil dari topik; bila diisi harus sama dengan topik, jika tidak paket ditolak |
| `pondId`                  | —      | tidak | Sama seperti di atas                           |
| `timestamp`               | ISO    | tidak | Device tanpa RTC tidak mengirimnya; server memakai waktu terima |
| `uptime`                  | detik  | tidak |                                                |
| `rssi`                    | dBm    | tidak | Kekuatan sinyal WiFi                           |
| `metrics.temperature`     | °C     | tidak | `null` bila sensor gagal dibaca                |
| `metrics.ph`              | —      | tidak | 0–14                                           |
| `metrics.tds`             | ppm    | tidak |                                                |
| `metrics.dissolvedOxygen` | mg/L   | tidak |                                                |
| `metrics.turbidity`       | NTU    | tidak |                                                |
| `metrics.waterLevel`      | cm     | tidak | Tinggi muka air dari dasar kolam               |

**Metrik `null` itu normal.** Satu sensor rusak tidak boleh membatalkan
pembacaan sensor lain, jadi firmware mengirim `null` untuk kanal yang gagal
dan backend menyimpannya apa adanya.

Backend juga menolak nilai di luar rentang wajar (lihat `PLAUSIBLE_RANGE` di
`backend/src/services/telemetrySchema.js`) dengan mengubahnya menjadi `null`
— pembacaan lain pada paket yang sama tetap tersimpan.

## `status` — kondisi perangkat

Retained, QoS 1. Dikirim saat device berhasil connect, dan otomatis oleh
broker sebagai **Last Will** saat koneksi putus mendadak.

```json
{
  "status": "online",
  "deviceId": "esp32-node-01",
  "pondId": "pond-01",
  "ip": "192.168.1.50",
  "rssi": -62,
  "uptime": 3600
}
```

Last Will yang tersimpan di broker:

```json
{ "status": "offline" }
```

`deviceId` dan `pondId` diambil dari topik saat payload Last Will minimal
seperti di atas.

Sebagai jaring pengaman (Last Will bisa hilang bila broker restart), backend
menandai device `offline` bila tidak ada paket selama 180 detik — lihat
`maintenanceService.js`.

## Kontrol aktuator

### `command` — perintah dari backend

Dikirim oleh `POST /api/devices/:id/commands`. Firmware berlangganan topik
ini setiap kali tersambung (clean session, jadi perintah saat device offline
**tidak** diantre — backend menolaknya dengan 409).

```json
{ "id": "0b5a1f4e-2c7d-4a8b-9e3f-1d2c3b4a5f60", "actuator": "aerator", "state": true, "durationS": 600 }
```

| Field       | Keterangan                                                    |
| ----------- | ------------------------------------------------------------- |
| `id`        | UUID perintah; wajib disertakan kembali di `ack`               |
| `actuator`  | `aerator`, `pump`, `feeder`                                   |
| `state`     | `true` nyala, `false` mati                                    |
| `durationS` | `null` atau detik; device mematikan sendiri setelah durasi habis |

Auto-off dijalankan oleh **device**, bukan server, sehingga feeder tetap
berhenti walau koneksi putus di tengah jalan.

### `ack` — balasan device

```json
{ "id": "0b5a1f4e-2c7d-4a8b-9e3f-1d2c3b4a5f60", "ok": true, "error": null }
```

`ok: false` dengan `error` (mis. `"aktuator tidak terpasang"`) menandai
perintah gagal. Backend hanya menerima ack dari device yang memang dituju.

### `actuators` — status relay (retained)

Diterbitkan saat connect, setelah setiap perintah, dan saat auto-off.

```json
{ "aerator": true, "pump": false, "feeder": false }
```

Kondisi saat boot diatur `*_ON_AT_BOOT` di `firmware/include/config.h`;
aerator default **menyala** agar listrik padam di malam hari tidak membuat
kolam kekurangan oksigen.

## Publikasi manual untuk pengujian

Broker mewajibkan login. Publish sebagai device memakai kredensialnya dari
`docker/mosquitto/credentials` (username = deviceId):

```bash
mosquitto_pub -h localhost -u esp32-node-01 -P '<password-device>' \
  -t 'fishpond/pond-01/esp32-node-01/telemetry' -q 1 -m '{
  "rssi":-60,
  "metrics":{"temperature":28.4,"ph":7.2,"tds":310,
             "dissolvedOxygen":6.8,"turbidity":12,"waterLevel":95}
}'
```

Memantau seluruh trafik (akun backend punya hak baca `fishpond/#`):

```bash
mosquitto_sub -h localhost -u fishpond-backend -P "$MQTT_BACKEND_PASSWORD" -t 'fishpond/#' -v
```

## Keamanan

### Autentikasi

`allow_anonymous false`: setiap klien wajib login. File password disusun
otomatis oleh [`docker/mosquitto/docker-entrypoint.sh`](../docker/mosquitto/docker-entrypoint.sh)
setiap kali container start:

| Akun                 | Sumber password                              | Keterangan                |
| -------------------- | -------------------------------------------- | ------------------------- |
| `fishpond-backend`   | `MQTT_BACKEND_PASSWORD` di `.env` root       | Wajib                     |
| `fishpond-simulator` | `MQTT_SIMULATOR_PASSWORD` di `.env` root     | Development; kosongkan di produksi |
| `<deviceId>`         | `docker/mosquitto/credentials`               | Satu baris per ESP32      |

Menambah device baru:

1. Tambahkan baris `esp32-node-03:<password-acak>` ke `docker/mosquitto/credentials`.
2. `docker compose restart mosquitto`
3. Di firmware, set `DEVICE_ID "esp32-node-03"` dan `MQTT_PASSWORD` yang sama
   di `include/secrets.h`. `MQTT_USERNAME` sudah otomatis bernilai `DEVICE_ID`.

Menghapus baris lalu me-restart broker langsung mencabut akses device tersebut.

### Otorisasi (ACL)

[`docker/mosquitto/acl`](../docker/mosquitto/acl) membatasi topik per akun:

- Device hanya boleh **menulis** `fishpond/+/<username>/telemetry|status` dan
  membaca `fishpond/+/<username>/command`. Device yang bobol tidak bisa
  mengirim data atas nama device lain.
- Backend hanya **membaca** `fishpond/#`.
- `use_username_as_clientid` mencegah device lain memakai client ID yang sama
  untuk menendang device asli dari broker.

Backend juga **menolak** paket yang `deviceId`/`pondId` di payload-nya berbeda
dari topik, sehingga ACL tidak bisa diakali lewat isi payload.

Segmen `pondId` tidak dikunci di ACL broker, tetapi backend menolak pesan
dari device ke kolam selain kolam terdaftarnya (lihat **Kunci kolam** di atas).
Device yang bobol tidak bisa mengotori data kolam lain.

### TLS (disarankan bila broker diakses dari luar jaringan lokal)

Tanpa TLS, password dan data dikirim apa adanya di jaringan. Untuk mengaktifkan:

1. Buat CA dan sertifikat server, simpan di `docker/mosquitto/certs/` (di-ignore git):

   ```bash
   cd docker/mosquitto/certs
   openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -keyout ca.key -out ca.crt -subj "/CN=fishpond-ca"
   openssl req -newkey rsa:2048 -nodes -keyout server.key -out server.csr -subj "/CN=<ip-atau-hostname-broker>"
   openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 825 -out server.crt \
     -extfile <(printf "subjectAltName=IP:<ip-broker>")   # atau DNS:<hostname>
   ```

2. Buka komentar blok `listener 8883` di `mosquitto.conf` dan tambahkan port
   `"8883:8883"` pada layanan `mosquitto` di `docker-compose.yml`.
3. Di firmware: `MQTT_USE_TLS 1`, `MQTT_PORT 8883`, dan salin isi `ca.crt` ke
   `MQTT_CA_CERT`.
4. Setelah semua device beralih, hapus pemetaan port 1883 (atau batasi ke
   jaringan internal) agar tidak ada jalur tanpa enkripsi.

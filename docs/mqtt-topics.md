# Skema Topik & Payload MQTT

Semua komunikasi device -> server memakai MQTT dengan QoS 1.

## Format topik

```
fishpond/<pondId>/<deviceId>/<kind>
```

| Bagian     | Contoh          | Keterangan                                   |
| ---------- | --------------- | -------------------------------------------- |
| `fishpond` | `fishpond`      | Prefix tetap (`MQTT_TOPIC_BASE` di firmware) |
| `pondId`   | `pond-01`       | Identitas kolam                              |
| `deviceId` | `esp32-node-01` | Identitas node, unik seluruh sistem          |
| `kind`     | `telemetry`     | Jenis pesan: `telemetry` atau `status`       |

Backend berlangganan dengan wildcard:

```
fishpond/+/+/telemetry
fishpond/+/+/status
```

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

> Batasan: segmen `pondId` pada topik belum dikunci per device. Device yang
> bobol masih bisa mengirim data atas namanya sendiri ke kolam lain.

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

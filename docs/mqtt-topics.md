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
| `deviceId`                | —      | ya    | Diambil dari topik bila tidak ada di payload   |
| `pondId`                  | —      | ya    | Sama seperti di atas                           |
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

```bash
mosquitto_pub -h localhost -t 'fishpond/pond-01/esp32-node-01/telemetry' -q 1 -m '{
  "deviceId":"esp32-node-01","pondId":"pond-01","rssi":-60,
  "metrics":{"temperature":28.4,"ph":7.2,"tds":310,
             "dissolvedOxygen":6.8,"turbidity":12,"waterLevel":95}
}'
```

Memantau seluruh trafik:

```bash
mosquitto_sub -h localhost -t 'fishpond/#' -v
```

## Catatan keamanan

Konfigurasi bawaan (`docker/mosquitto/mosquitto.conf`) mengizinkan koneksi
anonim agar mudah dikembangkan. Untuk pemasangan sungguhan:

1. Matikan `allow_anonymous`, buat kredensial per device dengan `mosquitto_passwd`.
2. Aktifkan listener TLS pada port 8883 dan pakai `WiFiClientSecure` di firmware.
3. Batasi ACL agar sebuah device hanya boleh menulis ke topiknya sendiri.

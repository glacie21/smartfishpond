# Referensi REST API

Base URL pengembangan: `http://localhost:4000/api`

Semua respons sukses dibungkus dalam objek `data`:

```json
{ "data": { } }
```

Semua respons gagal:

```json
{ "error": { "message": "Kolam \"pond-99\" tidak ditemukan", "details": null } }
```

| Kode | Arti                                   |
| ---- | -------------------------------------- |
| 200  | Berhasil                               |
| 201  | Sumber daya dibuat                     |
| 204  | Berhasil, tanpa body (penghapusan)     |
| 400  | Payload/query tidak valid              |
| 401  | Belum login / token tidak valid atau kedaluwarsa |
| 403  | Login, tetapi peran tidak cukup (mis. viewer menghapus kolam) |
| 404  | Tidak ditemukan                        |
| 409  | Konflik (id sudah dipakai)             |
| 429  | Terlalu banyak request (rate limit)    |
| 500  | Kesalahan server                       |
| 503  | Dependensi (database) tidak tersedia   |

---

## Autentikasi

Semua endpoint **kecuali** `GET /health` dan `POST /auth/login` wajib membawa
token JWT:

```
Authorization: Bearer <token>
```

| Peran    | Hak                                                        |
| -------- | ---------------------------------------------------------- |
| `viewer` | Semua endpoint `GET`                                       |
| `admin`  | Semua endpoint, termasuk `POST/PATCH/DELETE /ponds`        |

Akun dibuat dari CLI (tidak ada endpoint registrasi publik):

```bash
npm run user:create -- <username> --role admin|viewer
```

Token berlaku selama `JWT_EXPIRES_IN` (default `12h`). Token bersifat stateless:
menghapus user atau mengganti perannya baru berlaku setelah token lamanya
kedaluwarsa. Untuk mencabut semua sesi sekaligus, ganti `JWT_SECRET`.

### `POST /auth/login`

```json
{ "username": "admin", "password": "rahasia" }
```

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "id": "1", "username": "admin", "role": "admin" }
  }
}
```

Kredensial salah -> `401`. Lebih dari `LOGIN_RATE_LIMIT_MAX` (default 10)
percobaan gagal per IP dalam 15 menit -> `429`.

### `GET /auth/me`

Identitas pemilik token: `{ "id", "username", "role" }`.

### Rate limit

Seluruh `/api` dibatasi `RATE_LIMIT_MAX` request (default 600) per IP per
`RATE_LIMIT_WINDOW_MS` (default 15 menit). Sisa kuota ada di header
`RateLimit`. Bila backend berada di belakang reverse proxy, set `TRUST_PROXY`
(mis. `1`) agar limit dihitung per IP klien, bukan per IP proxy.

---

## Health

### `GET /health`

```json
{
  "status": "ok",
  "uptime": 3600,
  "dependencies": { "database": "up", "broker": "up" },
  "timestamp": "2026-09-04T10:00:00.000Z"
}
```

Mengembalikan `503` bila database tidak terjangkau. Dipakai juga sebagai
`HEALTHCHECK` container backend.

### `GET /metrics` (di luar `/api`)

Metrik format Prometheus. Aktif hanya bila `METRICS_TOKEN` diisi; wajib header
`Authorization: Bearer <METRICS_TOKEN>` (bukan token login). Di produksi, Caddy
memblokir path ini dari internet. Daftar metrik ada di
[operations.md → Monitoring](operations.md#monitoring).

---

## Kolam

### `GET /ponds`

Daftar kolam beserta jumlah device dan berapa yang online.

### `GET /ponds/:id`

Detail satu kolam.

### `GET /ponds/:id/overview`

Metadata kolam + daftar device + pembacaan terbaru tiap device. Endpoint yang
dipakai halaman detail dashboard.

```json
{
  "data": {
    "pond": { "id": "pond-01", "name": "Kolam A - Nila", "location": "Blok Utara" },
    "devices": [{ "id": "esp32-node-01", "status": "online", "rssi": -62 }],
    "latestReadings": [{ "device_id": "esp32-node-01", "temperature": 28.4, "ph": 7.21 }],
    "onlineCount": 1
  }
}
```

### `GET /ponds/:id/summary`

Statistik agregat (rata-rata/min/maks tiap metrik) untuk satu rentang waktu.

| Query  | Tipe          | Keterangan       |
| ------ | ------------- | ---------------- |
| `from` | ISO 8601      | Batas awal       |
| `to`   | ISO 8601      | Batas akhir      |

### `POST /ponds`

```json
{
  "id": "pond-03",
  "name": "Kolam C - Gurame",
  "location": "Blok Timur",
  "depthCm": 130,
  "fishType": "Gurame"
}
```

`id` hanya boleh berisi huruf, angka, `-`, dan `_`.

> Pendaftaran manual bersifat opsional: kolam dan device dibuat otomatis
> saat paket telemetri pertamanya masuk. Endpoint ini berguna untuk
> melengkapi nama, lokasi, dan komoditas.

### `PATCH /ponds/:id`

Semua field opsional; yang tidak dikirim tidak berubah.

### `DELETE /ponds/:id`

Menghapus kolam **beserta seluruh device dan pembacaannya** (`ON DELETE CASCADE`).

---

## Perangkat

### `GET /devices`

| Query    | Keterangan                  |
| -------- | --------------------------- |
| `pondId` | Saring berdasarkan kolam    |

### `GET /devices/:id`

Detail device + pembacaan terakhirnya (`latestReading`). Kolom `actuators`
berisi status relay terakhir yang dilaporkan device, mis.
`{ "aerator": true, "pump": false, "feeder": false }`.

### `POST /devices` — admin

Mendaftarkan device sebelum menyala, sekaligus menetapkan kolamnya.

```json
{ "id": "esp32-node-03", "pondId": "pond-03", "name": "Node Kolam C" }
```

`404` bila kolam tidak ada, `409` bila id sudah terdaftar.

### `PATCH /devices/:id` — admin

```json
{ "name": "Node Kolam C", "pondId": "pond-02" }
```

> **Kunci kolam.** Device terikat pada kolam terdaftarnya: pesan MQTT yang
> topiknya menyebut kolam lain **ditolak**. Saat memindah device lewat
> endpoint ini, ganti juga `POND_ID` di firmware.

### `DELETE /devices/:id` — admin

Menghapus device beserta pembacaan, alert, dan log perintahnya. Device yang
masih menyala akan terdaftar ulang otomatis; cabut juga kredensial MQTT-nya
di `docker/mosquitto/credentials`.

### `POST /devices/:id/commands` — admin

Menyalakan/mematikan aktuator lewat MQTT.

```json
{ "actuator": "feeder", "state": true, "durationS": 10 }
```

| Field       | Keterangan                                                          |
| ----------- | ------------------------------------------------------------------- |
| `actuator`  | `aerator`, `pump`, atau `feeder`                                    |
| `state`     | `true` = nyala, `false` = mati                                      |
| `durationS` | Opsional, hanya untuk `state: true`. Device mematikan sendiri setelah sekian detik (maks. 86400) |

Respons `202` berisi perintah berstatus `sent`. Hasilnya menyusul lewat event
Socket.IO `command:updated`:

| Status    | Arti                                                   |
| --------- | ------------------------------------------------------ |
| `sent`    | Terkirim ke broker, menunggu balasan device            |
| `done`    | Device menjalankan perintah                            |
| `failed`  | Device menolak (mis. aktuator tidak terpasang) atau broker putus |
| `timeout` | Tidak ada balasan dalam `COMMAND_ACK_TIMEOUT_SECONDS` (default 30) |

`409` bila device offline (perintah tidak diantre), `503` bila broker tidak tersambung.

### `GET /devices/:id/commands`

Riwayat perintah terbaru (audit: siapa, kapan, hasilnya). Query `limit` (default 20, maks. 100).

---

## Ambang batas

Rentang aman tiap metrik. Ada **default** untuk semua kolam, dan bisa
**diganti per kolam**. Dipakai untuk evaluasi alert di backend serta kartu dan
grafik di dashboard. `GET /ponds/:id/overview` juga menyertakan `thresholds`.

Metrik: `temperature`, `ph`, `tds`, `dissolved_oxygen`, `turbidity`, `water_level`.

### `GET /thresholds?pondId=pond-01`

```json
{
  "data": {
    "dissolved_oxygen": { "min": 5, "max": 12, "source": "default" },
    "temperature": { "min": 27, "max": 31, "source": "pond" }
  }
}
```

Tanpa `pondId`, yang dikembalikan hanya default.

### `PUT /thresholds/:metric` — admin

```json
{ "pondId": "pond-01", "min": 27, "max": 31 }
```

Tanpa `pondId` (atau `null`) mengubah **default** semua kolam. `min` harus < `max`.

### `DELETE /thresholds/:metric?pondId=pond-01` — admin

Menghapus override; kolam kembali memakai default.

---

## Alert

Alert dibuat otomatis oleh backend:

- **Metrik** — nilai di luar ambang selama `ALERT_CONFIRM_READINGS` pembacaan
  berturut-turut (default 2). Severity `warning`/`critical` memakai aturan yang
  sama dengan dashboard (selisih > 15% lebar rentang = kritis). Alert pulih
  setelah nilai kembali normal melewati margin 5% (hysteresis), agar tidak
  buka-tutup di garis batas.
- **Device offline** — device offline lebih dari `ALERT_OFFLINE_DELAY_SECONDS`
  (default 300). Pulih saat device mengirim status/telemetri lagi.

Notifikasi dikirim saat alert dibuka, memburuk (waspada → kritis), dan pulih.
Kanal saat ini: Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_IDS`).

### `GET /alerts`

| Query    | Default | Keterangan                      |
| -------- | ------- | ------------------------------- |
| `status` | `all`   | `open`, `resolved`, atau `all`  |
| `pondId` | —       | Saring per kolam                |
| `limit`  | 100     | Maks. 500                       |

```json
{
  "data": [{
    "id": 12, "type": "metric", "metric": "dissolved_oxygen", "severity": "critical",
    "value": 3.2, "min_value": 5, "max_value": 12,
    "message": "Oksigen terlarut 3.2 mg/L di bawah batas aman 5 mg/L",
    "pond_id": "pond-01", "pond_name": "Kolam A - Nila",
    "device_id": "esp32-node-01", "device_name": "Node Kolam A",
    "started_at": "...", "resolved_at": null,
    "acknowledged_at": null, "acknowledged_by": null
  }]
}
```

### `POST /alerts/:id/acknowledge`

Menandai alert sudah ditangani (semua user yang login). Tidak menutup alert;
alert tetap terbuka sampai kondisinya pulih. `400` bila sudah ditandai.

---

## Pembacaan

### `GET /readings`

Data mentah, urut naik menurut waktu (siap digambar sebagai grafik).

| Query      | Tipe     | Default | Keterangan                    |
| ---------- | -------- | ------- | ----------------------------- |
| `pondId`   | string   | —       | Saring per kolam              |
| `deviceId` | string   | —       | Saring per device             |
| `from`     | ISO 8601 | —       | Batas awal                    |
| `to`       | ISO 8601 | —       | Batas akhir                   |
| `limit`    | integer  | 1000    | Maksimum 5000                 |

### `GET /readings/aggregate`

Rata-rata/min/maks per bucket waktu. Dipakai grafik rentang panjang agar
jumlah titik tetap wajar.

| Query    | Default    | Nilai yang diizinkan                                                     |
| -------- | ---------- | ------------------------------------------------------------------------ |
| `bucket` | `1 hour`   | `5 minutes`, `15 minutes`, `30 minutes`, `1 hour`, `6 hours`, `1 day`     |

Kolom hasil: `bucket`, `sample_count`, lalu `<metrik>_avg`, `<metrik>_min`,
`<metrik>_max` untuk tiap metrik.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/readings/aggregate?pondId=pond-01&bucket=1%20hour&from=2026-09-03T00:00:00Z"
```

### `GET /readings/latest/:deviceId`

Pembacaan terakhir satu device, atau `null` bila belum pernah mengirim.

---

## Realtime (Socket.IO)

Endpoint WebSocket berada pada host yang sama (`/socket.io`). Handshake wajib
membawa token yang sama dengan REST API lewat `auth.token`; tanpa token,
koneksi ditolak dengan `connect_error`. Server memutus koneksi saat token
kedaluwarsa (alasan `io server disconnect`).

**Event dari klien:**

| Event               | Argumen    | Keterangan                  |
| ------------------- | ---------- | --------------------------- |
| `subscribe:pond`    | `pondId`   | Bergabung ke room kolam     |
| `unsubscribe:pond`  | `pondId`   | Keluar dari room            |
| `subscribe:device`  | `deviceId` | Bergabung ke room device    |

**Event dari server:**

| Event              | Payload                                   | Penerima          | Kapan                          |
| ------------------ | ----------------------------------------- | ----------------- | ------------------------------ |
| `reading:new`      | Baris reading yang baru masuk             | room kolam/device | Tiap telemetri tersimpan       |
| `device:status`    | Baris device                              | room kolam/device | Device online/offline berubah  |
| `device:actuators` | `{ id, actuators, actuators_updated_at }` | room kolam/device | Device melaporkan status relay |
| `command:updated`  | Baris perintah                            | room kolam/device | Perintah dikirim/dibalas/timeout |
| `alert:updated`    | Baris alert (+ `pond_name`, `device_name`) | semua klien      | Alert dibuka, memburuk, atau ditandai |
| `alert:resolved`   | Baris alert                               | semua klien       | Alert pulih                    |

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', { auth: { token } });
socket.on('connect', () => socket.emit('subscribe:pond', 'pond-01'));
socket.on('reading:new', (reading) => console.log(reading));
```

Room di-join ulang pada tiap event `connect` agar langganan tetap hidup
setelah reconnect.

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
| 404  | Tidak ditemukan                        |
| 409  | Konflik (id sudah dipakai)             |
| 500  | Kesalahan server                       |
| 503  | Dependensi (database) tidak tersedia   |

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

Mengembalikan `503` bila database tidak terjangkau.

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

Detail device + pembacaan terakhirnya (`latestReading`).

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
curl "http://localhost:4000/api/readings/aggregate?pondId=pond-01&bucket=1%20hour&from=2026-09-03T00:00:00Z"
```

### `GET /readings/latest/:deviceId`

Pembacaan terakhir satu device, atau `null` bila belum pernah mengirim.

---

## Realtime (Socket.IO)

Endpoint WebSocket berada pada host yang sama (`/socket.io`).

**Event dari klien:**

| Event               | Argumen    | Keterangan                  |
| ------------------- | ---------- | --------------------------- |
| `subscribe:pond`    | `pondId`   | Bergabung ke room kolam     |
| `unsubscribe:pond`  | `pondId`   | Keluar dari room            |
| `subscribe:device`  | `deviceId` | Bergabung ke room device    |

**Event dari server:**

| Event            | Payload                        | Kapan                        |
| ---------------- | ------------------------------ | ---------------------------- |
| `reading:new`    | Baris reading yang baru masuk  | Tiap telemetri tersimpan     |
| `device:status`  | Baris device                   | Device online/offline berubah |

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');
socket.on('connect', () => socket.emit('subscribe:pond', 'pond-01'));
socket.on('reading:new', (reading) => console.log(reading));
```

Room di-join ulang pada tiap event `connect` agar langganan tetap hidup
setelah reconnect.

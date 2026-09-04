# Hardware & Wiring

## Daftar komponen

| Komponen                       | Fungsi                    | Perkiraan | Catatan                                    |
| ------------------------------ | ------------------------- | --------- | ------------------------------------------ |
| ESP32 DevKit v1                | Mikrokontroler + WiFi     | 1 unit    | Pastikan varian dengan 30/38 pin           |
| DS18B20 (waterproof)           | Suhu air                  | 1 unit    | Butuh resistor pull-up 4,7 kΩ ke 3V3       |
| Sensor pH (mis. PH-4502C)      | Derajat keasaman          | 1 unit    | Modul beroperasi di 5 V, keluaran analog   |
| Sensor TDS (Gravity SEN0244)   | Total dissolved solids    | 1 unit    | 3,3–5,5 V                                  |
| Sensor DO (Gravity SEN0237)    | Oksigen terlarut          | 1 unit    | Membran perlu diganti berkala              |
| Sensor kekeruhan (SEN0189)     | Turbidity                 | 1 unit    | Keluaran 0–4,5 V pada 5 V                  |
| JSN-SR04T atau HC-SR04         | Level air (ultrasonik)    | 1 unit    | JSN-SR04T tahan lembap, lebih cocok        |
| Modul step-down 5 V            | Catu daya                 | 1 unit    | Bila memakai adaptor 12 V                  |
| Level shifter / pembagi tegangan | Proteksi ADC            | secukupnya | ESP32 hanya toleran 3,3 V                 |
| Box IP65 + kabel gland         | Pelindung elektronik      | 1 set     |                                            |

## Peta pin

Sesuai `firmware/include/config.h`:

| Sensor              | Pin ESP32 | Jenis        | Keterangan                             |
| ------------------- | --------- | ------------ | -------------------------------------- |
| DS18B20 (data)      | GPIO 4    | Digital      | OneWire + pull-up 4,7 kΩ ke 3V3        |
| pH                  | GPIO 34   | ADC1_CH6     | Input-only, wajib lewat pembagi tegangan |
| TDS                 | GPIO 35   | ADC1_CH7     | Input-only                             |
| DO                  | GPIO 32   | ADC1_CH4     |                                        |
| Turbidity           | GPIO 33   | ADC1_CH5     | Keluaran 5 V, wajib diturunkan ke 3,3 V |
| Ultrasonik `TRIG`   | GPIO 5    | Digital out  |                                        |
| Ultrasonik `ECHO`   | GPIO 18   | Digital in   | Turunkan ke 3,3 V (pembagi 1 kΩ/2 kΩ)  |
| LED status          | GPIO 2    | Digital out  | LED onboard                            |

> **Gunakan hanya ADC1 (GPIO 32–39).** ADC2 tidak dapat dipakai bersamaan
> dengan WiFi pada ESP32 — pembacaannya akan gagal begitu WiFi aktif.

### Pembagi tegangan untuk keluaran 5 V

Sensor turbidity dan pin `ECHO` mengeluarkan 5 V, sementara pin ESP32 maksimum
3,3 V. Pakai pembagi resistor:

```
Sensor 5V ──[ 1 kΩ ]──┬── GPIO ESP32 (3,3 V)
                      │
                   [ 2 kΩ ]
                      │
                     GND
```

## Kalibrasi

Nilai bawaan di `config.h` hanya titik awal. Kalibrasi ulang wajib dilakukan
karena tiap probe berbeda.

### pH — dua titik

1. Bilas probe dengan akuades, celupkan ke **buffer pH 7**, catat tegangan
   yang tercetak di serial monitor (`Sensors::readAnalogVolt(PIN_PH)`).
2. Ulangi dengan **buffer pH 4**.
3. Hitung:

   ```
   PH_SLOPE  = (7 - 4) / (V_pH7 - V_pH4)
   PH_OFFSET = 7 - PH_SLOPE * V_pH7
   ```

4. Masukkan hasilnya ke `PH_SLOPE` dan `PH_OFFSET`.

### TDS

Celupkan probe ke larutan standar (mis. 707 ppm). Sesuaikan `TDS_K_VALUE`
sampai pembacaan cocok. Kompensasi suhu sudah otomatis memakai DS18B20.

### DO (oksigen terlarut)

1. Aerasi segelas air bersuhu ruang minimal 10 menit hingga jenuh oksigen.
2. Celupkan probe, catat tegangan (mV) dan suhu saat stabil.
3. Isi `DO_CAL_VOLT_MV` dengan tegangan tersebut dan `DO_CAL_TEMP_C` dengan suhunya.

### Turbidity

Celupkan ke air jernih, catat tegangannya, lalu isi `TURBIDITY_CLEAR_V`.

### Level air

Ukur jarak dari permukaan sensor ke **dasar kolam** saat kolam kosong, lalu isi
`POND_DEPTH_CM`. Firmware menghitung `level = POND_DEPTH_CM - jarak_terukur`.

## Pemasangan di lapangan

- Pasang sensor ultrasonik tegak lurus permukaan air, minimal 20 cm di atas
  level tertinggi — di bawah itu berada dalam zona buta sensor.
- Jauhkan probe analog dari pompa dan aerator; gelembung membuat pembacaan
  kekeruhan dan DO melonjak.
- Sambungkan seluruh GND menjadi satu titik. Ground yang terpisah adalah
  penyebab paling umum pembacaan pH yang meloncat-loncat.
- Beri pelindung dari matahari langsung; panas berlebih mempercepat drift ADC.
- Bersihkan probe dari lumut tiap 2 minggu dan kalibrasi ulang pH tiap bulan.

## Konsumsi daya

Dengan WiFi aktif terus-menerus, node menarik sekitar 120–180 mA pada 5 V.
Untuk operasi bertenaga baterai/surya, ubah loop menjadi
`esp_deep_sleep_start()` di antara siklus publish — dengan interval 15 menit,
konsumsi rata-rata turun ke kisaran belasan mA.

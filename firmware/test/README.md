# test/

Unit test firmware dengan [PlatformIO Unit Testing](https://docs.platformio.org/page/plus/unit-testing.html)
dan framework Unity.

| Folder                 | Isi                                                       |
| ---------------------- | --------------------------------------------------------- |
| `test_pond_math/`      | Konversi sensor (pH, TDS, DO, kekeruhan, level air) dan timer auto-off aktuator dari `lib/PondMath` |

Jalankan di komputer biasa, tanpa board (butuh compiler C++ host: gcc/clang,
atau MinGW di Windows):

```bash
pio test -e native
```

Atau langsung di ESP32 yang tersambung via USB:

```bash
pio test -e esp32dev
```

CI menjalankan `pio test -e native` di setiap pull request.

Kode yang memanggil Arduino API (`analogRead`, `pulseIn`, relay) sengaja tipis
dan meneruskan perhitungan ke `PondMath`, sehingga logika yang rawan salah —
rumus kalibrasi dan aritmetika `millis()` yang melimpah — bisa diuji tanpa
hardware.

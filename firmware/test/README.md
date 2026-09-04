# test/

Unit test firmware dengan [PlatformIO Unit Testing](https://docs.platformio.org/page/plus/unit-testing.html).

Jalankan pada host (tanpa board) atau langsung pada target:

```bash
pio test -e esp32dev
```

Kandidat pengujian pertama: fungsi konversi pada `src/sensors.cpp`
(tegangan -> pH / TDS / NTU) karena murni matematis dan tidak butuh hardware.

# lib/

Library privat/lokal. Setiap library ditaruh pada sub-folder sendiri;
PlatformIO mengompilasi dan meng-inject include path-nya secara otomatis.
Library pihak ketiga cukup didaftarkan pada `lib_deps` di `platformio.ini`.

| Library     | Isi                                                                 |
| ----------- | ------------------------------------------------------------------- |
| `PondMath/` | Rumus konversi sensor dan helper waktu. Tanpa Arduino API dan tanpa `config.h` — konstanta kalibrasi lewat parameter — sehingga bisa diuji di host (`pio test -e native`). |

```
lib/
└── PondMath/
    └── src/
        ├── PondMath.h
        └── PondMath.cpp
```

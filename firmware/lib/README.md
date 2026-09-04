# lib/

Folder untuk library privat/lokal. Setiap library ditaruh pada sub-folder
sendiri, contoh:

```
lib/
└── PondCalibration/
    ├── PondCalibration.h
    └── PondCalibration.cpp
```

PlatformIO akan mengompilasi dan meng-inject include path-nya secara otomatis.
Library pihak ketiga cukup didaftarkan pada `lib_deps` di `platformio.ini`.

# GitHub Actions

`ci.yml` menjalankan tiga job paralel pada setiap push ke `main` dan setiap
pull request:

| Job        | Isi                                                    |
| ---------- | ------------------------------------------------------ |
| `backend`  | `npm test` (vitest) untuk skema telemetri & parser topik |
| `frontend` | `npm run build` — memastikan bundel Vite tetap berhasil |
| `firmware` | `pio run` — memastikan firmware ESP32 tetap dapat dikompilasi |

Job firmware menyalin `secrets.example.h` menjadi `secrets.h` karena file
aslinya sengaja tidak masuk repo.

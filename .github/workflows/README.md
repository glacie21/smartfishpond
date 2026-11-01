# GitHub Actions

`ci.yml` menjalankan job berikut secara paralel pada setiap push ke `main` dan
setiap pull request:

| Job                   | Isi                                                                 |
| --------------------- | ------------------------------------------------------------------- |
| `backend`             | ESLint + unit test (vitest, tanpa database)                          |
| `backend-integration` | Test integrasi terhadap PostgreSQL 16 (service container): migrasi dari nol, repository, rollup per jam, dan alur HTTP penuh |
| `frontend`            | ESLint (+ aturan React/hooks) + test komponen (vitest + Testing Library) + build Vite |
| `firmware`            | `pio test -e native` (rumus sensor & timer di host) + kompilasi ESP32 |
| `compose`             | `docker compose config` untuk stack dev dan produksi                |

Job firmware menyalin `secrets.example.h` menjadi `secrets.h` karena file
aslinya sengaja tidak masuk repo.

Menjalankan hal yang sama secara lokal:

```bash
npm run lint            # backend + frontend
npm test                # unit test backend + frontend
TEST_DATABASE_URL=postgres://fishpond:fishpond@localhost:5432/smartfishpond_test \
  npm run test:integration --workspace backend
pio test -d firmware -e native
```

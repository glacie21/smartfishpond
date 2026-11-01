# Berkontribusi

Terima kasih sudah ingin membantu! Panduan singkat agar perubahanmu mudah
ditinjau dan digabungkan.

## Menyiapkan lingkungan

Ikuti [Cara Menjalankan](README.md#-cara-menjalankan) di README. Tanpa
hardware pun semua fitur bisa dicoba lewat `npm run seed` dan
`npm run simulate`.

## Alur kerja

1. Buat branch dari `main`: `git checkout -b fitur/nama-singkat`
   (atau `perbaikan/...` untuk bug).
2. Buat perubahan kecil dan terfokus; satu PR untuk satu hal.
3. Pastikan semua pemeriksaan lulus (lihat di bawah).
4. Buka pull request ke `main` dengan penjelasan **apa** yang berubah dan
   **mengapa**. Sertakan tangkapan layar untuk perubahan tampilan.

## Sebelum membuka PR

```bash
npm run lint             # ESLint backend + frontend
npm test                 # unit test backend + frontend
```

Bila mengubah query SQL, migrasi, atau repository, jalankan juga test
integrasi terhadap PostgreSQL (database ini **dikosongkan** saat test):

```bash
docker compose up -d postgres
docker compose exec postgres createdb -U fishpond smartfishpond_test
TEST_DATABASE_URL=postgres://fishpond:ganti_password_ini@localhost:5432/smartfishpond_test npm run test:integration
```

Bila mengubah firmware:

```bash
pio test -d firmware -e native    # rumus sensor & logika waktu
pio run -d firmware -e esp32dev   # pastikan tetap terkompilasi
```

CI menjalankan semua pemeriksaan ini di setiap PR.

## Konvensi

- **Bahasa:** komentar, pesan log, pesan error untuk pengguna, dan dokumentasi
  memakai Bahasa Indonesia. Nama variabel/fungsi memakai bahasa Inggris.
- **Komentar:** jelaskan *mengapa*, bukan *apa*. Kode yang jelas tidak perlu
  dikomentari baris per baris.
- **Backend:** lapisan hanya memanggil ke bawah —
  `routes → controllers → services → repositories`. Query SQL hanya di
  `repositories/`. Validasi input dengan zod di controller.
- **Database:** perubahan skema selalu lewat file migrasi baru
  (`backend/src/db/migrations/NNN_nama.sql`); jangan mengubah migrasi yang
  sudah dirilis.
- **Firmware:** logika murni (rumus, perhitungan waktu) masuk `lib/PondMath`
  agar bisa diuji tanpa board; kode yang memanggil Arduino API dibuat tipis.
- **Rahasia:** jangan pernah meng-commit `.env`, `secrets.h`,
  `docker/mosquitto/credentials`, sertifikat, atau file backup.

## Pesan commit

Satu baris ringkas dalam Bahasa Indonesia, kalimat perintah, maksimal ~72
karakter, mis. `Tambah notifikasi WhatsApp untuk alert kritis`. Tambahkan
paragraf penjelasan bila perubahannya tidak jelas dari judulnya.

## Melaporkan bug & keamanan

Bug biasa: buka issue berisi langkah mereproduksi, perilaku yang diharapkan,
dan log yang relevan (hapus password/token sebelum menempel log).

Celah keamanan: **jangan** dibuka sebagai issue publik. Hubungi pemelihara
repo secara pribadi lewat GitHub.

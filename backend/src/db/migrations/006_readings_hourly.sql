-- ============================================================
--  006_readings_hourly — rollup per jam yang bertahan melewati retensi
--
--  Menggantikan materialized view `hourly_readings` (002). View itu dihitung
--  ulang dari tabel readings setiap refresh, sehingga riwayat lebih tua dari
--  RAW_RETENTION_DAYS tetap ikut hilang — dan tidak pernah di-refresh.
--
--  Tabel ini diisi bertahap oleh backend (services/rollupService.js) dan
--  punya retensi sendiri (HOURLY_RETENTION_DAYS). Kolom sum & count per metrik
--  membuat rata-rata tetap akurat saat beberapa jam digabung (6 jam, 1 hari)
--  meski sebagian pembacaan bernilai null.
-- ============================================================

DROP FUNCTION IF EXISTS refresh_hourly_readings();
DROP MATERIALIZED VIEW IF EXISTS hourly_readings;

CREATE TABLE IF NOT EXISTS readings_hourly (
    device_id               TEXT        NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
    pond_id                 TEXT        NOT NULL REFERENCES ponds (id) ON DELETE CASCADE,
    bucket                  TIMESTAMPTZ NOT NULL,          -- awal jam
    sample_count            INTEGER     NOT NULL,

    temperature_sum         NUMERIC,
    temperature_count       INTEGER     NOT NULL DEFAULT 0,
    temperature_min         NUMERIC(8, 2),
    temperature_max         NUMERIC(8, 2),

    ph_sum                  NUMERIC,
    ph_count                INTEGER     NOT NULL DEFAULT 0,
    ph_min                  NUMERIC(8, 2),
    ph_max                  NUMERIC(8, 2),

    tds_sum                 NUMERIC,
    tds_count               INTEGER     NOT NULL DEFAULT 0,
    tds_min                 NUMERIC(8, 2),
    tds_max                 NUMERIC(8, 2),

    dissolved_oxygen_sum    NUMERIC,
    dissolved_oxygen_count  INTEGER     NOT NULL DEFAULT 0,
    dissolved_oxygen_min    NUMERIC(8, 2),
    dissolved_oxygen_max    NUMERIC(8, 2),

    turbidity_sum           NUMERIC,
    turbidity_count         INTEGER     NOT NULL DEFAULT 0,
    turbidity_min           NUMERIC(8, 2),
    turbidity_max           NUMERIC(8, 2),

    water_level_sum         NUMERIC,
    water_level_count       INTEGER     NOT NULL DEFAULT 0,
    water_level_min         NUMERIC(8, 2),
    water_level_max         NUMERIC(8, 2),

    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- pond_id ikut di kunci: device yang dipindah kolam di tengah jam
    -- menghasilkan dua baris, masing-masing untuk kolamnya.
    PRIMARY KEY (device_id, pond_id, bucket)
);

CREATE INDEX IF NOT EXISTS idx_readings_hourly_pond_bucket
    ON readings_hourly (pond_id, bucket);
CREATE INDEX IF NOT EXISTS idx_readings_hourly_bucket
    ON readings_hourly (bucket);

-- Dipakai rollup ("reading dua jam terakhir") dan penghapusan retensi.
CREATE INDEX IF NOT EXISTS idx_readings_recorded_at ON readings (recorded_at);

-- Penanda sampai id readings mana rollup sudah diproses.
CREATE TABLE IF NOT EXISTS rollup_state (
    name             TEXT        PRIMARY KEY,
    last_reading_id  BIGINT      NOT NULL DEFAULT 0,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Isi awal dari seluruh data mentah yang masih ada.
INSERT INTO readings_hourly (
    device_id, pond_id, bucket, sample_count,
    temperature_sum, temperature_count, temperature_min, temperature_max,
    ph_sum, ph_count, ph_min, ph_max,
    tds_sum, tds_count, tds_min, tds_max,
    dissolved_oxygen_sum, dissolved_oxygen_count, dissolved_oxygen_min, dissolved_oxygen_max,
    turbidity_sum, turbidity_count, turbidity_min, turbidity_max,
    water_level_sum, water_level_count, water_level_min, water_level_max
)
SELECT device_id, pond_id, date_trunc('hour', recorded_at), count(*),
       sum(temperature), count(temperature), min(temperature), max(temperature),
       sum(ph), count(ph), min(ph), max(ph),
       sum(tds), count(tds), min(tds), max(tds),
       sum(dissolved_oxygen), count(dissolved_oxygen), min(dissolved_oxygen), max(dissolved_oxygen),
       sum(turbidity), count(turbidity), min(turbidity), max(turbidity),
       sum(water_level), count(water_level), min(water_level), max(water_level)
  FROM readings
 GROUP BY device_id, pond_id, date_trunc('hour', recorded_at)
ON CONFLICT DO NOTHING;

INSERT INTO rollup_state (name, last_reading_id)
SELECT 'readings_hourly', COALESCE(max(id), 0) FROM readings
ON CONFLICT (name) DO NOTHING;

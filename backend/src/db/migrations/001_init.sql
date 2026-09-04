-- ============================================================
--  001_init — skema dasar Smart Fish Pond IoT
-- ============================================================

-- Kolam ikan yang dipantau.
CREATE TABLE IF NOT EXISTS ponds (
    id          TEXT PRIMARY KEY,               -- contoh: 'pond-01'
    name        TEXT        NOT NULL,
    location    TEXT,
    depth_cm    NUMERIC(6, 2),                  -- kedalaman kolam (cm)
    fish_type   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Node ESP32 yang terpasang pada sebuah kolam.
CREATE TABLE IF NOT EXISTS devices (
    id            TEXT PRIMARY KEY,             -- contoh: 'esp32-node-01'
    pond_id       TEXT        NOT NULL REFERENCES ponds (id) ON DELETE CASCADE,
    name          TEXT,
    status        TEXT        NOT NULL DEFAULT 'offline'
                  CHECK (status IN ('online', 'offline')),
    ip_address    TEXT,
    rssi          INTEGER,
    uptime_s      BIGINT,
    last_seen_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devices_pond ON devices (pond_id);

-- Telemetri mentah. Satu baris = satu paket dari device.
-- Kolom metrik boleh NULL karena sebuah sensor bisa gagal dibaca
-- tanpa membatalkan pembacaan lainnya.
CREATE TABLE IF NOT EXISTS readings (
    id                BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id         TEXT        NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
    pond_id           TEXT        NOT NULL REFERENCES ponds (id) ON DELETE CASCADE,
    recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    temperature       NUMERIC(5, 2),   -- degC
    ph                NUMERIC(4, 2),   -- 0..14
    tds               NUMERIC(7, 2),   -- ppm
    dissolved_oxygen  NUMERIC(5, 2),   -- mg/L
    turbidity         NUMERIC(7, 2),   -- NTU
    water_level       NUMERIC(6, 2),   -- cm
    rssi              INTEGER
);

-- Kueri dashboard selalu "data terbaru untuk satu kolam/device",
-- sehingga indeks menurun pada waktu adalah yang paling terpakai.
CREATE INDEX IF NOT EXISTS idx_readings_pond_time
    ON readings (pond_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_device_time
    ON readings (device_id, recorded_at DESC);

-- Pembacaan terbaru per device — dipakai kartu status di dashboard.
CREATE OR REPLACE VIEW latest_readings AS
SELECT DISTINCT ON (device_id) *
FROM readings
ORDER BY device_id, recorded_at DESC;

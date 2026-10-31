-- ============================================================
--  004_thresholds_alerts — ambang batas metrik & riwayat alert
-- ============================================================

-- Rentang aman tiap metrik. pond_id NULL = default untuk semua kolam;
-- baris dengan pond_id mengganti default khusus untuk kolam itu.
CREATE TABLE IF NOT EXISTS thresholds (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pond_id     TEXT        REFERENCES ponds (id) ON DELETE CASCADE,
    metric      TEXT        NOT NULL CHECK (metric IN (
                    'temperature', 'ph', 'tds', 'dissolved_oxygen', 'turbidity', 'water_level')),
    min_value   NUMERIC(8, 2) NOT NULL,
    max_value   NUMERIC(8, 2) NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (min_value < max_value)
);

-- Satu default per metrik, dan satu override per (kolam, metrik).
CREATE UNIQUE INDEX IF NOT EXISTS uq_thresholds_default
    ON thresholds (metric) WHERE pond_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_thresholds_pond
    ON thresholds (pond_id, metric) WHERE pond_id IS NOT NULL;

-- Default: acuan umum budidaya air tawar (nila/lele/mas), sama dengan
-- nilai bawaan dashboard sebelumnya.
INSERT INTO thresholds (pond_id, metric, min_value, max_value) VALUES
    (NULL, 'temperature',      26,  32),
    (NULL, 'ph',               6.5, 8.5),
    (NULL, 'tds',              100, 500),
    (NULL, 'dissolved_oxygen', 5,   12),
    (NULL, 'turbidity',        0,   50),
    (NULL, 'water_level',      60,  120)
ON CONFLICT DO NOTHING;

-- Alert: satu baris = satu kejadian, dari mulai sampai pulih.
CREATE TABLE IF NOT EXISTS alerts (
    id               BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pond_id          TEXT        NOT NULL REFERENCES ponds (id) ON DELETE CASCADE,
    device_id        TEXT        NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
    type             TEXT        NOT NULL CHECK (type IN ('metric', 'device_offline')),
    metric           TEXT,                      -- terisi bila type = 'metric'
    severity         TEXT        NOT NULL CHECK (severity IN ('warning', 'critical')),
    value            NUMERIC(8, 2),             -- nilai terakhir yang memicu/memperbarui
    min_value        NUMERIC(8, 2),             -- ambang saat alert dibuat
    max_value        NUMERIC(8, 2),
    message          TEXT        NOT NULL,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at      TIMESTAMPTZ,
    acknowledged_at  TIMESTAMPTZ,
    acknowledged_by  TEXT
);

-- Paling banyak satu alert terbuka per (device, jenis, metrik).
CREATE UNIQUE INDEX IF NOT EXISTS uq_alerts_open
    ON alerts (device_id, type, COALESCE(metric, ''))
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_started ON alerts (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_pond_started ON alerts (pond_id, started_at DESC);

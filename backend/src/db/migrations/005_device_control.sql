-- ============================================================
--  005_device_control — status aktuator & log perintah ke device
-- ============================================================

-- Status relay terakhir yang dilaporkan device lewat topik .../actuators,
-- mis. {"aerator": true, "pump": false, "feeder": false}.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS actuators JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS actuators_updated_at TIMESTAMPTZ;

-- Jejak audit setiap perintah: siapa, kapan, apa, dan hasilnya.
CREATE TABLE IF NOT EXISTS device_commands (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id     TEXT        NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
    actuator      TEXT        NOT NULL,
    state         BOOLEAN     NOT NULL,
    duration_s    INTEGER     CHECK (duration_s > 0),
    status        TEXT        NOT NULL DEFAULT 'sent'
                  CHECK (status IN ('sent', 'done', 'failed', 'timeout')),
    error         TEXT,
    requested_by  TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    acked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_device_commands_device_time
    ON device_commands (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_commands_pending
    ON device_commands (created_at) WHERE status = 'sent';

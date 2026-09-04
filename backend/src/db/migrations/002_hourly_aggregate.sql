-- ============================================================
--  002_hourly_aggregate — agregasi per jam untuk grafik rentang panjang
--
--  Menggambar 30 hari data mentah (setiap 30 detik) berarti ~86k titik
--  per metrik. Materialized view ini memampatkannya menjadi rata-rata,
--  minimum, dan maksimum per jam sehingga grafik tetap ringan.
--  Segarkan berkala: SELECT refresh_hourly_readings();
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_readings AS
SELECT
    pond_id,
    device_id,
    date_trunc('hour', recorded_at)          AS bucket,
    count(*)                                 AS sample_count,
    avg(temperature)                         AS temperature_avg,
    min(temperature)                         AS temperature_min,
    max(temperature)                         AS temperature_max,
    avg(ph)                                  AS ph_avg,
    min(ph)                                  AS ph_min,
    max(ph)                                  AS ph_max,
    avg(tds)                                 AS tds_avg,
    avg(dissolved_oxygen)                    AS dissolved_oxygen_avg,
    min(dissolved_oxygen)                    AS dissolved_oxygen_min,
    avg(turbidity)                           AS turbidity_avg,
    avg(water_level)                         AS water_level_avg
FROM readings
GROUP BY pond_id, device_id, date_trunc('hour', recorded_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_readings_key
    ON hourly_readings (pond_id, device_id, bucket);

-- Indeks unik di atas memungkinkan refresh CONCURRENTLY (tanpa mengunci baca).
CREATE OR REPLACE FUNCTION refresh_hourly_readings()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_readings;
END;
$$;

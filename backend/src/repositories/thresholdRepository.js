import { query } from '../db/pool.js';

/**
 * Ambang efektif untuk satu kolam: override kolam bila ada, selain itu default.
 * Tanpa pondId, hanya default yang dikembalikan.
 */
export async function findEffective(pondId) {
  const { rows } = await query(
    `SELECT DISTINCT ON (metric)
            metric, min_value, max_value,
            CASE WHEN pond_id IS NULL THEN 'default' ELSE 'pond' END AS source
       FROM thresholds
      WHERE pond_id IS NULL OR pond_id = $1
      ORDER BY metric, pond_id NULLS LAST`,
    [pondId ?? null],
  );
  return rows;
}

export async function upsertDefault(metric, { min, max }) {
  const { rows } = await query(
    `INSERT INTO thresholds (pond_id, metric, min_value, max_value)
     VALUES (NULL, $1, $2, $3)
     ON CONFLICT (metric) WHERE pond_id IS NULL
     DO UPDATE SET min_value = EXCLUDED.min_value,
                   max_value = EXCLUDED.max_value,
                   updated_at = now()
     RETURNING *`,
    [metric, min, max],
  );
  return rows[0];
}

export async function upsertForPond(pondId, metric, { min, max }) {
  const { rows } = await query(
    `INSERT INTO thresholds (pond_id, metric, min_value, max_value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (pond_id, metric) WHERE pond_id IS NOT NULL
     DO UPDATE SET min_value = EXCLUDED.min_value,
                   max_value = EXCLUDED.max_value,
                   updated_at = now()
     RETURNING *`,
    [pondId, metric, min, max],
  );
  return rows[0];
}

/** Menghapus override kolam; kolam kembali memakai default. */
export async function removeForPond(pondId, metric) {
  const { rowCount } = await query(
    'DELETE FROM thresholds WHERE pond_id = $1 AND metric = $2',
    [pondId, metric],
  );
  return rowCount > 0;
}

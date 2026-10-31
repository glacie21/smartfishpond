import * as pondRepository from '../repositories/pondRepository.js';
import * as thresholdRepository from '../repositories/thresholdRepository.js';
import { badRequest, notFound } from '../utils/errors.js';
import { METRIC_KEYS } from './metrics.js';

/**
 * Ambang efektif sebagai objek per metrik:
 *   { dissolved_oxygen: { min: 5, max: 12, source: 'default' }, ... }
 */
export async function getEffective(pondId) {
  const rows = await thresholdRepository.findEffective(pondId);
  return Object.fromEntries(
    rows.map((row) => [row.metric, { min: row.min_value, max: row.max_value, source: row.source }]),
  );
}

function assertMetric(metric) {
  if (!METRIC_KEYS.includes(metric)) {
    throw badRequest(`Metrik "${metric}" tidak dikenal. Pilihan: ${METRIC_KEYS.join(', ')}`);
  }
}

/** Mengubah default (pondId kosong) atau override satu kolam. */
export async function setThreshold(metric, { pondId, min, max }) {
  assertMetric(metric);
  if (!pondId) return thresholdRepository.upsertDefault(metric, { min, max });

  if (!(await pondRepository.findById(pondId))) throw notFound(`Kolam "${pondId}" tidak ditemukan`);
  return thresholdRepository.upsertForPond(pondId, metric, { min, max });
}

export async function resetThreshold(metric, pondId) {
  assertMetric(metric);
  const removed = await thresholdRepository.removeForPond(pondId, metric);
  if (!removed) throw notFound(`Kolam "${pondId}" tidak punya ambang khusus untuk ${metric}`);
}

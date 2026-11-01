import * as readingRepository from '../repositories/readingRepository.js';
import { badRequest } from '../utils/errors.js';

/** Bucket agregasi yang diizinkan — dibatasi karena nilainya masuk ke SQL. */
const ALLOWED_BUCKETS = new Set([
  '5 minutes',
  '15 minutes',
  '30 minutes',
  '1 hour',
  '6 hours',
  '1 day',
]);

/**
 * Bucket kelipatan jam dibaca dari rollup readings_hourly: lebih ringan untuk
 * rentang panjang dan tetap tersedia setelah data mentah melewati retensi.
 * Bucket di bawah satu jam butuh data mentah.
 */
const HOURLY_BUCKETS = new Set(['1 hour', '6 hours', '1 day']);

const MAX_LIMIT = 5000;

export function getHistory({ pondId, deviceId, from, to, limit }) {
  const safeLimit = Math.min(Number(limit) || 1000, MAX_LIMIT);
  return readingRepository.findHistory({ pondId, deviceId, from, to, limit: safeLimit });
}

export function getAggregated({ pondId, deviceId, from, to, bucket = '1 hour' }) {
  if (!ALLOWED_BUCKETS.has(bucket)) {
    throw badRequest(
      `bucket "${bucket}" tidak didukung`,
      { allowed: [...ALLOWED_BUCKETS] },
    );
  }
  const filter = { pondId, deviceId, from, to, bucket };
  return HOURLY_BUCKETS.has(bucket)
    ? readingRepository.findAggregatedFromHourly(filter)
    : readingRepository.findAggregated(filter);
}

export function getLatestByDevice(deviceId) {
  return readingRepository.findLatestByDevice(deviceId);
}

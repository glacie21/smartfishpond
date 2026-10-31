/**
 * Metadata metrik untuk pesan alert & notifikasi. Kunci memakai nama kolom
 * tabel readings (snake_case), sama dengan frontend/src/constants/metrics.js.
 */
export const METRIC_INFO = {
  temperature: { label: 'Suhu air', unit: '°C' },
  ph: { label: 'pH', unit: '' },
  tds: { label: 'TDS', unit: 'ppm' },
  dissolved_oxygen: { label: 'Oksigen terlarut', unit: 'mg/L' },
  turbidity: { label: 'Kekeruhan', unit: 'NTU' },
  water_level: { label: 'Level air', unit: 'cm' },
};

export const METRIC_KEYS = Object.keys(METRIC_INFO);

const SEVERITY_RANK = { normal: 0, warning: 1, critical: 2 };

export const severityRank = (severity) => SEVERITY_RANK[severity] ?? 0;

/**
 * Status sebuah nilai terhadap rentang aman [min, max].
 * Selisih > 15% dari lebar rentang dianggap kritis, sisanya waspada —
 * aturan yang sama dengan evaluateMetric di frontend.
 */
export function evaluateValue(value, [min, max]) {
  if (value === null || value === undefined) return 'unknown';
  if (value >= min && value <= max) return 'normal';
  const span = max - min;
  const distance = value < min ? min - value : value - max;
  return distance > span * 0.15 ? 'critical' : 'warning';
}

/**
 * Hysteresis: alert baru dianggap pulih bila nilai sudah masuk rentang aman
 * dengan selisih 5% dari lebar rentang, di sisi tempat pelanggaran terjadi.
 * Mencegah alert buka-tutup terus saat nilai berada tepat di garis batas.
 */
export function isClearOf(value, [min, max], violatedSide) {
  const margin = (max - min) * 0.05;
  if (violatedSide === 'low') return value >= min + margin && value <= max;
  if (violatedSide === 'high') return value <= max - margin && value >= min;
  return value >= min && value <= max;
}

export function formatValue(metric, value) {
  const unit = METRIC_INFO[metric]?.unit;
  return unit ? `${value} ${unit}` : String(value);
}

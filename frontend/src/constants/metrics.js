/**
 * Definisi metrik: label, satuan, rentang aman untuk budidaya air tawar,
 * dan warna grafik. Satu sumber kebenaran agar kartu, grafik, dan tabel
 * selalu konsisten.
 *
 * Rentang aman di bawah adalah acuan umum (nila/lele/mas). Sesuaikan
 * dengan komoditas kolam Anda.
 */
export const METRICS = [
  {
    key: 'temperature',
    label: 'Suhu Air',
    unit: '°C',
    safeRange: [26, 32],
    decimals: 1,
    color: '#ef4444',
  },
  {
    key: 'ph',
    label: 'pH',
    unit: '',
    safeRange: [6.5, 8.5],
    decimals: 2,
    color: '#8b5cf6',
  },
  {
    key: 'tds',
    label: 'TDS',
    unit: 'ppm',
    safeRange: [100, 500],
    decimals: 0,
    color: '#f59e0b',
  },
  {
    key: 'dissolved_oxygen',
    label: 'Oksigen Terlarut',
    unit: 'mg/L',
    safeRange: [5, 12],
    decimals: 2,
    color: '#06b6d4',
  },
  {
    key: 'turbidity',
    label: 'Kekeruhan',
    unit: 'NTU',
    safeRange: [0, 50],
    decimals: 1,
    color: '#84cc16',
  },
  {
    key: 'water_level',
    label: 'Level Air',
    unit: 'cm',
    safeRange: [60, 120],
    decimals: 1,
    color: '#3b82f6',
  },
];

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m]));

/**
 * Rentang aman [min, max] sebuah metrik. `thresholds` adalah objek dari API
 * (`overview.thresholds`, bisa berisi override per kolam); bila tidak ada,
 * dipakai `safeRange` bawaan di atas.
 */
export function rangeFor(key, thresholds) {
  const t = thresholds?.[key];
  return t ? [Number(t.min), Number(t.max)] : METRIC_BY_KEY[key]?.safeRange;
}

/**
 * Status sebuah nilai terhadap rentang amannya — aturan yang sama dengan
 * backend (services/metrics.js) agar kartu dan alert selalu sepakat.
 */
export function evaluateMetric(key, value, range = rangeFor(key)) {
  if (value === null || value === undefined) return 'unknown';
  if (!range) return 'unknown';

  const [min, max] = range;
  if (value < min || value > max) {
    // Selisih > 15% dari lebar rentang aman dianggap kritis, sisanya waspada.
    const span = max - min;
    const distance = value < min ? min - value : value - max;
    return distance > span * 0.15 ? 'critical' : 'warning';
  }
  return 'normal';
}

/** Format nilai metrik menjadi teks siap tampil. */
export function formatMetric(key, value) {
  if (value === null || value === undefined) return '—';
  const metric = METRIC_BY_KEY[key];
  const decimals = metric?.decimals ?? 1;
  return Number(value).toFixed(decimals);
}

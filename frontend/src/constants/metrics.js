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
    icon: 'thermometer',
    label: 'Suhu Air',
    unit: '°C',
    safeRange: [26, 32],
    decimals: 1,
    color: '#ef4444',
  },
  {
    key: 'ph',
    icon: 'flask',
    label: 'pH',
    unit: '',
    safeRange: [6.5, 8.5],
    decimals: 2,
    color: '#8b5cf6',
  },
  {
    key: 'tds',
    icon: 'gauge',
    label: 'TDS',
    unit: 'ppm',
    safeRange: [100, 500],
    decimals: 0,
    color: '#f59e0b',
  },
  {
    key: 'dissolved_oxygen',
    icon: 'wind',
    label: 'Oksigen Terlarut',
    unit: 'mg/L',
    safeRange: [5, 12],
    decimals: 2,
    color: '#06b6d4',
  },
  {
    key: 'turbidity',
    icon: 'eye',
    label: 'Kekeruhan',
    unit: 'NTU',
    safeRange: [0, 50],
    decimals: 1,
    color: '#84cc16',
  },
  {
    key: 'water_level',
    icon: 'waves',
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

const STATUS_RANK = { unknown: 0, normal: 1, warning: 2, critical: 3 };

/** Status paling parah dari beberapa status (untuk ringkasan kolam). */
export function worstStatus(statuses) {
  return statuses.reduce((worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst), 'unknown');
}

/** Format nilai metrik menjadi teks siap tampil. */
export function formatMetric(key, value) {
  if (value === null || value === undefined) return '—';
  const metric = METRIC_BY_KEY[key];
  const decimals = metric?.decimals ?? 1;
  return Number(value).toFixed(decimals);
}

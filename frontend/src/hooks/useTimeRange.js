import { useMemo, useState } from 'react';

/** Pilihan rentang waktu grafik beserta bucket agregasi yang sepadan. */
export const TIME_RANGES = [
  { id: '1h', label: '1 Jam', hours: 1, bucket: '5 minutes' },
  { id: '6h', label: '6 Jam', hours: 6, bucket: '15 minutes' },
  { id: '24h', label: '24 Jam', hours: 24, bucket: '30 minutes' },
  { id: '7d', label: '7 Hari', hours: 24 * 7, bucket: '1 hour' },
  { id: '30d', label: '30 Hari', hours: 24 * 30, bucket: '6 hours' },
];

/**
 * State rentang waktu + parameter query yang sudah jadi.
 * `from`/`to` dihitung ulang hanya saat rentang berubah, bukan tiap render,
 * agar tidak memicu request berulang.
 */
export function useTimeRange(defaultId = '24h') {
  const [rangeId, setRangeId] = useState(defaultId);

  const range = TIME_RANGES.find((r) => r.id === rangeId) ?? TIME_RANGES[2];

  const params = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - range.hours * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString(), bucket: range.bucket };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeId]);

  return { rangeId, setRangeId, range, params };
}

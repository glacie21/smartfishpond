import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../api/client.js';
import { DeviceTable } from '../components/DeviceTable.jsx';
import { MetricGrid } from '../components/MetricGrid.jsx';
import { ErrorState, Loading } from '../components/StateViews.jsx';
import { TimeRangeSelector } from '../components/TimeRangeSelector.jsx';
import { TrendChart } from '../components/TrendChart.jsx';
import { METRICS } from '../constants/metrics.js';
import { useApi } from '../hooks/useApi.js';
import { usePondRealtime } from '../hooks/useRealtime.js';
import { useTimeRange } from '../hooks/useTimeRange.js';

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'medium',
});

/**
 * Detail satu kolam: kartu metrik terkini (di-push realtime via WebSocket),
 * grafik tren per metrik, dan daftar perangkat.
 */
export function PondDetail() {
  const { pondId } = useParams();
  const { rangeId, setRangeId, params } = useTimeRange('24h');

  const overview = useApi(() => api.getPondOverview(pondId), [pondId]);
  const trend = useApi(
    () => api.getAggregatedReadings({ pondId, ...params }),
    [pondId, params],
  );

  const { connected, latestReading, deviceStatus } = usePondRealtime(pondId);

  // Pembacaan awal dari REST, lalu ditimpa tiap paket baru dari WebSocket.
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    const initial = overview.data?.latestReadings?.[0] ?? null;
    if (initial) setCurrent(initial);
  }, [overview.data]);

  useEffect(() => {
    if (latestReading) setCurrent(latestReading);
  }, [latestReading]);

  // Status device dari WebSocket digabungkan ke daftar hasil REST.
  const devices = useMemo(() => {
    const list = overview.data?.devices ?? [];
    if (!deviceStatus) return list;
    return list.map((d) => (d.id === deviceStatus.id ? { ...d, ...deviceStatus } : d));
  }, [overview.data, deviceStatus]);

  if (overview.loading) return <Loading label="Memuat data kolam..." />;
  if (overview.error) {
    return <ErrorState message={overview.error} onRetry={overview.refetch} />;
  }

  const pond = overview.data.pond;

  return (
    <>
      <div className="page-header">
        <div>
          <Link to="/" className="page-header__back">
            &larr; Semua kolam
          </Link>
          <h2 className="page-header__title">{pond.name}</h2>
          <p className="page-header__subtitle">
            {pond.location ?? 'Lokasi belum diisi'}
            {' · '}
            {current?.recorded_at
              ? `Pembaruan terakhir ${timeFormatter.format(new Date(current.recorded_at))}`
              : 'Belum ada pembacaan'}
          </p>
        </div>

        <span className={`live-indicator${connected ? ' is-live' : ''}`}>
          <span className="live-indicator__dot" aria-hidden="true" />
          {connected ? 'Realtime aktif' : 'Realtime terputus'}
        </span>
      </div>

      <MetricGrid reading={current} />

      <div className="section-header">
        <h3 className="section-header__title">Tren</h3>
        <TimeRangeSelector value={rangeId} onChange={setRangeId} />
      </div>

      {trend.error ? (
        <ErrorState message={trend.error} onRetry={trend.refetch} />
      ) : trend.loading ? (
        <Loading label="Memuat grafik..." />
      ) : (
        <div className="chart-grid">
          {METRICS.map((metric) => (
            <TrendChart
              key={metric.key}
              metricKey={metric.key}
              data={trend.data}
              valueKey={`${metric.key}_avg`}
            />
          ))}
        </div>
      )}

      <div className="section-header">
        <h3 className="section-header__title">Perangkat</h3>
      </div>
      <DeviceTable devices={devices} />
    </>
  );
}

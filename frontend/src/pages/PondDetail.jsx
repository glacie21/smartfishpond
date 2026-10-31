import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../api/client.js';
import { ActuatorPanel } from '../components/ActuatorPanel.jsx';
import { AlertList } from '../components/AlertList.jsx';
import { DeviceTable } from '../components/DeviceTable.jsx';
import { MetricGrid } from '../components/MetricGrid.jsx';
import { ErrorState, Loading } from '../components/StateViews.jsx';
import { ThresholdEditor } from '../components/ThresholdEditor.jsx';
import { TimeRangeSelector } from '../components/TimeRangeSelector.jsx';
import { TrendChart } from '../components/TrendChart.jsx';
import { METRICS, rangeFor } from '../constants/metrics.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAlertFeed } from '../hooks/useAlerts.js';
import { useApi } from '../hooks/useApi.js';
import { usePondRealtime } from '../hooks/useRealtime.js';
import { useTimeRange } from '../hooks/useTimeRange.js';

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'medium',
});

/**
 * Detail satu kolam: kartu metrik terkini (di-push realtime via WebSocket),
 * alert aktif, kendali aktuator, grafik tren, daftar perangkat, dan
 * pengaturan ambang batas (admin).
 */
export function PondDetail() {
  const { pondId } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { rangeId, setRangeId, params } = useTimeRange('24h');

  const overview = useApi(() => api.getPondOverview(pondId), [pondId]);
  const trend = useApi(
    () => api.getAggregatedReadings({ pondId, ...params }),
    [pondId, params],
  );
  const pondAlerts = useAlertFeed({ status: 'open', pondId });

  const { connected, latestReading, devicePatches, commands } = usePondRealtime(pondId);

  // Pembacaan awal dari REST, lalu ditimpa tiap paket baru dari WebSocket.
  const [current, setCurrent] = useState(null);
  // Ambang dari overview; diperbarui lokal saat admin menyimpan perubahan.
  const [thresholds, setThresholds] = useState(null);
  const [showThresholds, setShowThresholds] = useState(false);

  useEffect(() => {
    const initial = overview.data?.latestReadings?.[0] ?? null;
    if (initial) setCurrent(initial);
    setThresholds(overview.data?.thresholds ?? null);
  }, [overview.data]);

  useEffect(() => {
    if (latestReading) setCurrent(latestReading);
  }, [latestReading]);

  // Status & aktuator dari WebSocket digabungkan ke daftar hasil REST.
  const devices = useMemo(
    () => (overview.data?.devices ?? []).map((d) => ({ ...d, ...devicePatches[d.id] })),
    [overview.data, devicePatches],
  );

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
            📍 {pond.location ?? 'Lokasi belum diisi'}
            {' · '}
            {current?.recorded_at
              ? `🕐 Pembaruan terakhir ${timeFormatter.format(new Date(current.recorded_at))}`
              : 'Belum ada pembacaan'}
          </p>
        </div>

        <span className={`live-indicator${connected ? ' is-live' : ''}`}>
          <span className="live-indicator__dot" aria-hidden="true" />
          {connected ? 'Realtime aktif' : 'Realtime terputus'}
        </span>
      </div>

      <MetricGrid reading={current} thresholds={thresholds} />

      {pondAlerts.alerts.length > 0 && (
        <>
          <div className="section-header">
            <h3 className="section-header__title">🚨 Alert aktif</h3>
            <span className="section-header__count">{pondAlerts.alerts.length} kejadian</span>
          </div>
          <AlertList alerts={pondAlerts.alerts} showPond={false} onAcknowledge={pondAlerts.acknowledge} />
        </>
      )}

      {devices.length > 0 && (
        <>
          <div className="section-header">
            <h3 className="section-header__title">🎛️ Kendali aktuator</h3>
          </div>
          <div className="actuator-grid">
            {devices.map((device) => (
              <ActuatorPanel key={device.id} device={device} canControl={isAdmin} commands={commands} />
            ))}
          </div>
        </>
      )}

      <div className="section-header">
        <h3 className="section-header__title">📈 Tren</h3>
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
              range={rangeFor(metric.key, thresholds)}
            />
          ))}
        </div>
      )}

      <div className="section-header">
        <h3 className="section-header__title">📡 Perangkat</h3>
      </div>
      <DeviceTable devices={devices} />

      {isAdmin && (
        <>
          <div className="section-header">
            <h3 className="section-header__title">🎯 Ambang batas</h3>
            <button type="button" className="btn btn--quiet btn--small" onClick={() => setShowThresholds((v) => !v)}>
              {showThresholds ? 'Sembunyikan' : 'Atur'}
            </button>
          </div>
          {showThresholds && (
            <ThresholdEditor pondId={pondId} thresholds={thresholds} onChange={setThresholds} />
          )}
        </>
      )}
    </>
  );
}

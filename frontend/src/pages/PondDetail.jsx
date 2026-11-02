import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';

import { api } from '../api/client.js';
import { ActuatorPanel } from '../components/ActuatorPanel.jsx';
import { AlertList } from '../components/AlertList.jsx';
import { DeviceTable } from '../components/DeviceTable.jsx';
import { Icon } from '../components/Icon.jsx';
import { MetricGrid } from '../components/MetricCard.jsx';
import { PondForm } from '../components/PondForm.jsx';
import { ErrorState, Loading, Skeleton } from '../components/StateViews.jsx';
import { ThresholdEditor } from '../components/ThresholdEditor.jsx';
import { TrendChart } from '../components/TrendChart.jsx';
import { PageHeader, SectionHeader, Segmented } from '../components/ui.jsx';
import { METRICS, rangeFor } from '../constants/metrics.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAction } from '../hooks/useAction.js';
import { useApi } from '../hooks/useApi.js';
import { useNow } from '../hooks/useNow.js';
import { usePondRealtime } from '../hooks/useRealtime.js';
import { TIME_RANGES, useTimeRange } from '../hooks/useTimeRange.js';
import { formatDateTime, formatRelative, isStale } from '../lib/format.js';

/** Pembacaan paling baru di antara beberapa kandidat (null diabaikan). */
export const newest = (...readings) =>
  readings
    .filter(Boolean)
    .reduce((a, b) => (!a || new Date(b.recorded_at) > new Date(a.recorded_at) ? b : a), null);

/**
 * Detail satu kolam: kartu metrik terkini (di-push realtime via WebSocket),
 * alert aktif, kendali aktuator, grafik tren, daftar perangkat, serta
 * pengaturan kolam & ambang batas (admin).
 */
export function PondDetail() {
  const { pondId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const now = useNow();
  const { alerts: openAlerts, acknowledge } = useOutletContext();
  const { rangeId, setRangeId, range, params } = useTimeRange('24h');
  const [panel, setPanel] = useState(null); // null | 'edit' | 'thresholds'

  const overview = useApi(() => api.getPondOverview(pondId), [pondId]);
  const trend = useApi(() => api.getAggregatedReadings({ pondId, ...params }), [pondId, params]);
  const { connected, latestReading, devicePatches, commands } = usePondRealtime(pondId);
  const remove = useAction(async () => {
    await api.deletePond(pondId);
    navigate('/', { replace: true });
  });

  // Status & aktuator dari WebSocket digabungkan ke daftar hasil REST.
  const devices = useMemo(
    () => (overview.data?.devices ?? []).map((d) => ({ ...d, ...devicePatches[d.id] })),
    [overview.data, devicePatches],
  );
  const alerts = openAlerts.filter((a) => a.pond_id === pondId);

  if (overview.error) return <ErrorState message={overview.error} onRetry={overview.refetch} />;
  // Data kolam sebelumnya masih terpegang sesaat setelah pindah kolam.
  if (overview.loading || overview.data.pond.id !== pondId) return <Skeleton count={6} height={150} />;

  const { pond, thresholds } = overview.data;
  const current = newest(latestReading, ...(overview.data.latestReadings ?? []));
  const stale = isStale(current?.recorded_at, now);
  const setThresholds = (next) => overview.setData((d) => ({ ...d, thresholds: next }));

  function handleDelete() {
    const ok = window.confirm(
      `Hapus kolam ${pond.name}? Semua perangkat, riwayat pembacaan, dan alert kolam ini ikut terhapus.`,
    );
    if (ok) remove.run();
  }

  return (
    <>
      <PageHeader
        back={{ to: '/', label: 'Semua kolam' }}
        title={pond.name}
        subtitle={
          <>
            <Icon name="pin" size={14} /> {pond.location ?? 'Lokasi belum diisi'}
            {pond.fish_type && <> · <Icon name="fish" size={14} /> {pond.fish_type}</>}
            {' · '}
            <span className={stale ? 'text-warning' : undefined} title={formatDateTime(current?.recorded_at)}>
              <Icon name="clock" size={14} /> {current ? `Diperbarui ${formatRelative(current.recorded_at, now)}` : 'Belum ada pembacaan'}
            </span>
          </>
        }
      >
        <span className={`live${connected ? ' is-live' : ''}`}>
          <span className="live__dot" aria-hidden="true" />
          {connected ? 'Realtime aktif' : 'Realtime terputus'}
        </span>
        {isAdmin && (
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setPanel(panel === 'edit' ? null : 'edit')}>
              <Icon name="pencil" size={16} /> Ubah
            </button>
            <button type="button" className="btn btn--danger" onClick={handleDelete} disabled={remove.busy}>
              <Icon name="trash" size={16} /> Hapus
            </button>
          </>
        )}
      </PageHeader>

      {remove.error && <p className="form-error">{remove.error}</p>}
      {panel === 'edit' && (
        <PondForm
          pond={pond}
          onDone={(updated) => {
            overview.setData((d) => ({ ...d, pond: { ...d.pond, ...updated } }));
            setPanel(null);
          }}
          onCancel={() => setPanel(null)}
        />
      )}

      {stale && current && (
        <p className="banner is-warning" role="status">
          <Icon name="alert" size={16} /> Tidak ada data baru selama lebih dari 10 menit — periksa koneksi perangkat.
        </p>
      )}

      <MetricGrid reading={current} thresholds={thresholds} />

      {alerts.length > 0 && (
        <>
          <SectionHeader icon="bell" title="Alert aktif">
            <span className="muted">{alerts.length} kejadian</span>
          </SectionHeader>
          <AlertList alerts={alerts} showPond={false} onAcknowledge={acknowledge} />
        </>
      )}

      {devices.length > 0 && (
        <>
          <SectionHeader icon="zap" title="Kendali aktuator" />
          <div className="actuator-grid">
            {devices.map((device) => (
              <ActuatorPanel key={device.id} device={device} canControl={isAdmin} commands={commands} />
            ))}
          </div>
        </>
      )}

      <SectionHeader icon="chart" title="Tren">
        <Segmented options={TIME_RANGES} value={rangeId} onChange={setRangeId} label="Rentang waktu" />
      </SectionHeader>
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
              multiDay={range.hours > 24}
            />
          ))}
        </div>
      )}

      <SectionHeader icon="cpu" title="Perangkat" />
      <DeviceTable devices={devices} />

      {isAdmin && (
        <>
          <SectionHeader icon="sliders" title="Ambang batas">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setPanel(panel === 'thresholds' ? null : 'thresholds')}
              aria-expanded={panel === 'thresholds'}
            >
              {panel === 'thresholds' ? 'Sembunyikan' : 'Atur'}
            </button>
          </SectionHeader>
          {panel === 'thresholds' && <ThresholdEditor pondId={pondId} thresholds={thresholds} onChange={setThresholds} />}
        </>
      )}
    </>
  );
}

import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import { api } from '../api/client.js';
import { Icon } from '../components/Icon.jsx';
import { PondForm } from '../components/PondForm.jsx';
import { EmptyState, ErrorState, Skeleton } from '../components/StateViews.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { PageHeader, SectionHeader } from '../components/ui.jsx';
import { formatMetric, METRIC_BY_KEY, METRICS, worstStatus } from '../constants/metrics.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useNow } from '../hooks/useNow.js';
import { usePondRooms } from '../hooks/useRealtime.js';
import { formatRelative, isStale } from '../lib/format.js';

const POND_STATUS_LABEL = {
  normal: 'Normal',
  warning: 'Waspada',
  critical: 'Kritis',
  offline: 'Offline',
  unknown: 'Belum ada data',
};

/** Kelompokkan alert terbuka per kolam: { [pondId]: { list, byMetric } }. */
function groupAlerts(alerts) {
  const groups = {};
  for (const alert of alerts) {
    const group = (groups[alert.pond_id] ??= { list: [], byMetric: {} });
    group.list.push(alert);
    if (alert.metric) group.byMetric[alert.metric] = worstStatus([group.byMetric[alert.metric] ?? 'unknown', alert.severity]);
  }
  return groups;
}

/** Status kolam: alert backend didahulukan, lalu konektivitas & kesegaran data. */
function pondStatus(pond, group, now) {
  if (group?.list.length) return worstStatus(group.list.map((a) => a.severity));
  if (!pond.latest_reading) return 'unknown';
  if (!pond.device_online || isStale(pond.latest_reading.recorded_at, now)) return 'offline';
  return 'normal';
}

function PondCard({ pond, group, now }) {
  const status = pondStatus(pond, group, now);
  const reading = pond.latest_reading;
  const stale = reading && isStale(reading.recorded_at, now);

  return (
    <Link to={`/ponds/${pond.id}`} className={`card card--link pond-card is-${status}`}>
      <header className="pond-card__header">
        <div>
          <h3 className="pond-card__name">{pond.name}</h3>
          <p className="pond-card__meta">
            <Icon name="pin" size={14} /> {pond.location ?? 'Lokasi belum diisi'}
            {pond.fish_type && (
              <>
                <Icon name="fish" size={14} /> {pond.fish_type}
              </>
            )}
          </p>
        </div>
        <StatusBadge status={status}>{POND_STATUS_LABEL[status]}</StatusBadge>
      </header>

      <ul className="pond-card__metrics">
        {METRICS.map((metric) => (
          <li key={metric.key} className={`chip is-${group?.byMetric[metric.key] ?? 'normal'}`} title={metric.label}>
            <Icon name={metric.icon} size={14} />
            <span className="chip__value">{formatMetric(metric.key, reading?.[metric.key])}</span>
            <span className="chip__unit">{metric.unit}</span>
          </li>
        ))}
      </ul>

      <footer className="pond-card__footer">
        <span>
          <Icon name="cpu" size={14} /> {pond.device_online}/{pond.device_count} perangkat online
        </span>
        <span className={stale ? 'text-warning' : undefined}>
          <Icon name="clock" size={14} /> {formatRelative(reading?.recorded_at, now)}
        </span>
      </footer>
    </Link>
  );
}

function Stat({ icon, label, value, hint, tone }) {
  return (
    <article className={`card stat${tone ? ` is-${tone}` : ''}`}>
      <span className="stat__icon">
        <Icon name={icon} />
      </span>
      <div>
        <span className="stat__label">{label}</span>
        <strong className="stat__value">{value}</strong>
        {hint && <span className="stat__hint">{hint}</span>}
      </div>
    </article>
  );
}

/** Halaman utama: ringkasan sistem dan kartu setiap kolam, diperbarui realtime. */
export function Dashboard() {
  const { user } = useAuth();
  const { alerts } = useOutletContext();
  const now = useNow();
  const [creating, setCreating] = useState(false);
  const { data: ponds, loading, error, refetch, setData } = useApi(() => api.listPonds(), []);

  // Pembacaan baru langsung mengganti nilai di kartu; status device memicu muat ulang senyap.
  usePondRooms((ponds ?? []).map((p) => p.id), {
    'reading:new': (reading) =>
      setData((list) => list?.map((p) => (p.id === reading.pond_id ? { ...p, latest_reading: reading } : p))),
    'device:status': () => refetch({ silent: true }),
  });

  const groups = useMemo(() => groupAlerts(alerts), [alerts]);

  if (loading) return <Skeleton count={3} height={220} />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const isAdmin = user?.role === 'admin';
  const devices = ponds.reduce((n, p) => n + p.device_count, 0);
  const online = ponds.reduce((n, p) => n + p.device_online, 0);
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const lastReading = Math.max(0, ...ponds.map((p) => Date.parse(p.latest_reading?.recorded_at) || 0)) || null;
  const form = creating && (
    <PondForm
      onDone={() => {
        setCreating(false);
        refetch({ silent: true });
      }}
      onCancel={() => setCreating(false)}
    />
  );
  const addButton = isAdmin && !creating && (
    <button type="button" className="btn" onClick={() => setCreating(true)}>
      <Icon name="plus" size={16} /> Tambah kolam
    </button>
  );

  if (!ponds.length) {
    return (
      <>
        {form}
        <EmptyState icon="droplet" title="Belum ada kolam terdaftar">
          <p className="state__hint">
            Kolam otomatis dibuat begitu sebuah device mengirim telemetri pertamanya. Untuk mencoba tanpa hardware,
            jalankan <code>npm run simulate</code>.
          </p>
          {addButton}
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Pusat kendali"
        title={alerts.length ? `${alerts.length} alert perlu perhatian` : 'Semua kolam dalam kondisi aman'}
        subtitle={`Data terbaru dari ${ponds.length} kolam dan ${devices} perangkat.`}
      >
        <button type="button" className="btn btn--ghost" onClick={() => refetch({ silent: true })}>
          <Icon name="refresh" size={16} /> Segarkan
        </button>
        {addButton}
      </PageHeader>

      <section className="stat-grid" aria-label="Statistik sistem">
        <Stat icon="droplet" label="Kolam" value={ponds.length} hint="terpantau" />
        <Stat
          icon="cpu"
          label="Perangkat online"
          value={`${online}/${devices}`}
          hint={online < devices ? `${devices - online} offline` : 'semua terhubung'}
          tone={online < devices ? 'warning' : 'normal'}
        />
        <Stat
          icon="bell"
          label="Alert aktif"
          value={alerts.length}
          hint={criticalCount ? `${criticalCount} kritis` : 'tidak ada yang kritis'}
          tone={criticalCount ? 'critical' : alerts.length ? 'warning' : 'normal'}
        />
        <Stat icon="clock" label="Data terakhir" value={formatRelative(lastReading, now)} tone={isStale(lastReading, now) ? 'warning' : undefined} />
      </section>

      {alerts.length > 0 && (
        <section className="card attention" aria-label="Perlu perhatian">
          <Icon name="alert" size={20} className="attention__icon" />
          <ul className="attention__list">
            {alerts.slice(0, 3).map((alert) => (
              <li key={alert.id}>
                <Link to={`/ponds/${alert.pond_id}`}>
                  <strong>{alert.pond_name ?? alert.pond_id}</strong> ·{' '}
                  {alert.type === 'device_offline' ? 'Perangkat offline' : METRIC_BY_KEY[alert.metric]?.label} —{' '}
                  {alert.message}
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/alerts" className="btn btn--ghost btn--sm">
            Lihat semua
          </Link>
        </section>
      )}

      {form}

      <SectionHeader icon="grid" title="Daftar kolam">
        <span className="muted">{ponds.length} lokasi</span>
      </SectionHeader>
      <div className="card-grid">
        {ponds.map((pond) => (
          <PondCard key={pond.id} pond={pond} group={groups[pond.id]} now={now} />
        ))}
      </div>
    </>
  );
}

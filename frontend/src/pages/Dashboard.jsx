import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../api/client.js';
import { evaluateMetric, METRICS } from '../constants/metrics.js';
import { ErrorState, Loading, EmptyState } from '../components/StateViews.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApi } from '../hooks/useApi.js';

/** Halaman utama: daftar kolam beserta ringkasan jumlah device. */
export function Dashboard() {
  const { data, loading, error, refetch } = useApi(async () => {
    const ponds = await api.listPonds();
    const overviews = await Promise.all(
      ponds.map((pond) => api.getPondOverview(pond.id).catch(() => null)),
    );
    return { ponds, overviews };
  }, []);

  const ponds = data?.ponds ?? [];
  const overviews = data?.overviews ?? [];
  const stats = useMemo(() => {
    const readings = overviews.flatMap((overview) => overview?.latestReadings ?? []);
    const alerts = readings.flatMap((reading) =>
      METRICS.filter((metric) => ['warning', 'critical'].includes(
        evaluateMetric(metric.key, reading[metric.key]),
      )).map((metric) => ({ ...metric, reading })),
    );
    const deviceCount = ponds.reduce((total, pond) => total + Number(pond.device_count ?? 0), 0);
    const onlineCount = ponds.reduce((total, pond) => total + Number(pond.device_online ?? 0), 0);

    return {
      deviceCount,
      onlineCount,
      alertCount: alerts.length,
      alerts: alerts.slice(0, 3),
    };
  }, [overviews, ponds]);

  if (loading) return <Loading label="Memuat daftar kolam..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  if (!ponds?.length) {
    return (
      <EmptyState>
        <p>Belum ada kolam terdaftar.</p>
        <p className="state__hint">
          Kolam otomatis dibuat begitu sebuah device mengirim telemetri pertamanya.
          Untuk mencoba tanpa hardware, jalankan <code>node scripts/simulate-device.js</code>.
        </p>
      </EmptyState>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Pusat kendali</p>
          <h2 className="page-header__title">Kondisi kolam hari ini</h2>
          <p className="page-header__subtitle">Pantau kesehatan air dan konektivitas perangkat dari satu tempat.</p>
        </div>
        <button type="button" className="btn btn--quiet" onClick={refetch}>
          <span aria-hidden="true">↻</span> Segarkan data
        </button>
      </div>

      <section className="dashboard-hero" aria-label="Ringkasan sistem">
        <div>
          <p className="dashboard-hero__kicker">Ringkasan sistem</p>
          <h3>{stats.alertCount ? `${stats.alertCount} parameter perlu perhatian` : 'Semua parameter dalam batas aman'}</h3>
          <p>Data terbaru dari {ponds.length} kolam dan {stats.deviceCount} perangkat terdaftar.</p>
        </div>
        <div className="dashboard-hero__signal" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="stat-grid" aria-label="Statistik sistem">
        <article className="stat-card">
          <span className="stat-card__label">Kolam aktif</span>
          <strong>{ponds.length}</strong>
          <span className="stat-card__hint">terpantau sistem</span>
        </article>
        <article className="stat-card stat-card--positive">
          <span className="stat-card__label">Perangkat online</span>
          <strong>{stats.onlineCount}<small>/{stats.deviceCount}</small></strong>
          <span className="stat-card__hint">koneksi aktif</span>
        </article>
        <article className={`stat-card${stats.alertCount ? ' stat-card--warning' : ' stat-card--positive'}`}>
          <span className="stat-card__label">Peringatan</span>
          <strong>{stats.alertCount}</strong>
          <span className="stat-card__hint">parameter di luar batas</span>
        </article>
      </section>

      {stats.alerts.length > 0 && (
        <section className="attention-panel" aria-labelledby="attention-title">
          <div>
            <p className="eyebrow">Perlu perhatian</p>
            <h3 id="attention-title">Periksa parameter berikut</h3>
          </div>
          <div className="attention-list">
            {stats.alerts.map((alert, index) => (
              <span key={`${alert.key}-${alert.reading.device_id ?? index}`} className="attention-item">
                <span className="attention-item__dot" style={{ background: alert.color }} />
                {alert.label} <strong>{alert.reading[alert.key]}</strong> {alert.unit}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="section-header section-header--ponds">
        <div>
          <p className="eyebrow">Monitoring</p>
          <h3 className="section-header__title">Daftar kolam</h3>
        </div>
        <span className="section-header__count">{ponds.length} lokasi</span>
      </div>

      <div className="pond-grid">
        {ponds.map((pond) => {
          const online = Number(pond.device_online) > 0;
          return (
            <Link key={pond.id} to={`/ponds/${pond.id}`} className="pond-card">
              <div className="pond-card__header">
                <h3 className="pond-card__name">{pond.name}</h3>
                <StatusBadge status={online ? 'online' : 'offline'} />
              </div>

              <dl className="pond-card__meta">
                <div>
                  <dt>Lokasi</dt>
                  <dd>{pond.location ?? '-'}</dd>
                </div>
                <div>
                  <dt>Komoditas</dt>
                  <dd>{pond.fish_type ?? '-'}</dd>
                </div>
                <div>
                  <dt>Perangkat</dt>
                  <dd>
                    {pond.device_online}/{pond.device_count} online
                  </dd>
                </div>
              </dl>
            </Link>
          );
        })}
      </div>
    </>
  );
}

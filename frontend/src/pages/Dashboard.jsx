import { Link } from 'react-router-dom';

import { api } from '../api/client.js';
import { ErrorState, Loading, EmptyState } from '../components/StateViews.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useApi } from '../hooks/useApi.js';

/** Halaman utama: daftar kolam beserta ringkasan jumlah device. */
export function Dashboard() {
  const { data: ponds, loading, error, refetch } = useApi(() => api.listPonds(), []);

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
        <h2 className="page-header__title">Kolam</h2>
        <p className="page-header__subtitle">{ponds.length} kolam terpantau</p>
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

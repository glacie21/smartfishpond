import { useState } from 'react';

import { AlertList } from '../components/AlertList.jsx';
import { ErrorState, Loading } from '../components/StateViews.jsx';
import { useAlertFeed } from '../hooks/useAlerts.js';

const TABS = [
  { id: 'open', label: 'Aktif' },
  { id: 'all', label: 'Riwayat' },
];

/** Pusat alert: kejadian aktif dan riwayat seluruh kolam. */
export function Alerts() {
  const [status, setStatus] = useState('open');
  const { alerts, loading, error, reload, acknowledge } = useAlertFeed({ status });

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Pemantauan</p>
          <h2 className="page-header__title">Alert</h2>
          <p className="page-header__subtitle">
            Parameter di luar ambang batas dan perangkat yang berhenti mengirim data.
          </p>
        </div>
        <div className="range-selector" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={status === tab.id}
              className={`range-selector__btn${status === tab.id ? ' is-active' : ''}`}
              onClick={() => setStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Loading label="Memuat alert..." />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <AlertList
          alerts={alerts}
          onAcknowledge={acknowledge}
          emptyText={status === 'open' ? '✓ Tidak ada alert aktif. Semua kolam dalam kondisi aman.' : 'Belum ada riwayat alert.'}
        />
      )}
    </>
  );
}

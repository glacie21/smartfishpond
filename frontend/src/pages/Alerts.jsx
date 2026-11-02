import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { AlertList } from '../components/AlertList.jsx';
import { ErrorState, Loading } from '../components/StateViews.jsx';
import { PageHeader, Segmented } from '../components/ui.jsx';
import { useAlertFeed } from '../hooks/useAlerts.js';

const EMPTY_TEXT = {
  open: '✓ Tidak ada alert aktif. Semua kolam dalam kondisi aman.',
  resolved: 'Belum ada alert yang pulih.',
  all: 'Belum ada riwayat alert.',
};

/** Pusat alert: kejadian aktif dan riwayat seluruh kolam. */
export function Alerts() {
  const [status, setStatus] = useState('open');
  const [severity, setSeverity] = useState('all');
  // Tab "Aktif" memakai feed bersama dari Layout; tab lain memuat sendiri.
  // Selagi di tab Aktif, riwayat "Pulih" dimuat lebih dulu agar tab itu langsung tampil.
  const shared = useOutletContext();
  const history = useAlertFeed({ status: status === 'open' ? 'resolved' : status, limit: 200 });
  const feed = status === 'open' ? shared : history;
  const visible = severity === 'all' ? feed.alerts : feed.alerts.filter((a) => a.severity === severity);

  return (
    <>
      <PageHeader
        eyebrow="Pemantauan"
        title="Alert"
        subtitle="Parameter di luar ambang batas dan perangkat yang berhenti mengirim data."
      >
        <Segmented
          label="Status alert"
          value={status}
          onChange={setStatus}
          options={[
            { id: 'open', label: 'Aktif', count: shared.alerts.length },
            { id: 'resolved', label: 'Pulih' },
            { id: 'all', label: 'Semua' },
          ]}
        />
      </PageHeader>

      <div className="toolbar">
        <Segmented
          label="Tingkat keparahan"
          value={severity}
          onChange={setSeverity}
          options={[
            { id: 'all', label: 'Semua tingkat' },
            { id: 'critical', label: 'Kritis' },
            { id: 'warning', label: 'Waspada' },
          ]}
        />
      </div>

      {feed.loading ? (
        <Loading label="Memuat alert..." />
      ) : feed.error ? (
        <ErrorState message={feed.error} onRetry={feed.reload} />
      ) : (
        <AlertList alerts={visible} onAcknowledge={feed.acknowledge} emptyText={EMPTY_TEXT[status]} />
      )}
    </>
  );
}

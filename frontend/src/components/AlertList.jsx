import { useState } from 'react';
import { Link } from 'react-router-dom';

import { METRIC_BY_KEY } from '../constants/metrics.js';
import { StatusBadge } from './StatusBadge.jsx';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Durasi singkat: "12 mnt", "3 jam 5 mnt", "2 hari". */
function formatDuration(from, to = new Date()) {
  const minutes = Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000));
  if (minutes < 60) return `${minutes} mnt`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} jam${minutes % 60 ? ` ${minutes % 60} mnt` : ''}`;
  return `${Math.floor(hours / 24)} hari`;
}

function AlertItem({ alert, showPond, onAcknowledge }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const resolved = Boolean(alert.resolved_at);
  const title =
    alert.type === 'device_offline' ? 'Perangkat offline' : METRIC_BY_KEY[alert.metric]?.label ?? alert.metric;

  async function handleAcknowledge() {
    setBusy(true);
    setError(null);
    try {
      await onAcknowledge(alert.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`alert-item alert-item--${resolved ? 'resolved' : alert.severity}`}>
      <div className="alert-item__main">
        <div className="alert-item__title">
          <StatusBadge status={resolved ? 'normal' : alert.severity}>
            {resolved ? 'Pulih' : alert.severity === 'critical' ? 'Kritis' : 'Waspada'}
          </StatusBadge>
          <strong>{title}</strong>
        </div>
        <p className="alert-item__message">{alert.message}</p>
        <p className="alert-item__meta">
          {showPond && (
            <>
              <Link to={`/ponds/${alert.pond_id}`}>{alert.pond_name ?? alert.pond_id}</Link>
              {' · '}
            </>
          )}
          {alert.device_name ?? alert.device_id}
          {' · '}
          mulai {dateFormatter.format(new Date(alert.started_at))}
          {' · '}
          {resolved
            ? `berlangsung ${formatDuration(alert.started_at, alert.resolved_at)}`
            : `sudah ${formatDuration(alert.started_at)}`}
        </p>
        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="alert-item__side">
        {alert.acknowledged_at ? (
          <span className="alert-item__ack">✓ Ditangani {alert.acknowledged_by}</span>
        ) : (
          !resolved && (
            <button type="button" className="btn btn--quiet btn--small" onClick={handleAcknowledge} disabled={busy}>
              {busy ? 'Menyimpan...' : 'Tandai ditangani'}
            </button>
          )
        )}
      </div>
    </li>
  );
}

/** Daftar alert; dipakai halaman Alert dan ringkasan di detail kolam. */
export function AlertList({ alerts, showPond = true, onAcknowledge, emptyText = 'Tidak ada alert.' }) {
  if (!alerts?.length) return <p className="state state--empty">{emptyText}</p>;

  return (
    <ul className="alert-list">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} showPond={showPond} onAcknowledge={onAcknowledge} />
      ))}
    </ul>
  );
}

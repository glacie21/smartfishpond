import { Link } from 'react-router-dom';

import { METRIC_BY_KEY } from '../constants/metrics.js';
import { useAction } from '../hooks/useAction.js';
import { formatDateTime, formatDuration } from '../lib/format.js';
import { Icon } from './Icon.jsx';
import { EmptyState } from './StateViews.jsx';
import { StatusBadge } from './StatusBadge.jsx';

function AlertItem({ alert, showPond, onAcknowledge }) {
  const { busy, error, run } = useAction(onAcknowledge);
  const resolved = Boolean(alert.resolved_at);
  const offline = alert.type === 'device_offline';
  const title = offline ? 'Perangkat offline' : METRIC_BY_KEY[alert.metric]?.label ?? alert.metric;
  const icon = offline ? 'cpu' : METRIC_BY_KEY[alert.metric]?.icon ?? 'alert';

  return (
    <li className={`card alert-item is-${resolved ? 'resolved' : alert.severity}`}>
      <span className="alert-item__icon">
        <Icon name={icon} />
      </span>

      <div className="alert-item__main">
        <div className="alert-item__title">
          <strong>{title}</strong>
          <StatusBadge status={resolved ? 'normal' : alert.severity}>
            {resolved ? 'Pulih' : alert.severity === 'critical' ? 'Kritis' : 'Waspada'}
          </StatusBadge>
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
          <time dateTime={alert.started_at}>mulai {formatDateTime(alert.started_at)}</time>
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
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => run(alert.id)} disabled={busy}>
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
  if (!alerts?.length) {
    return (
      <EmptyState icon="check">
        <p>{emptyText}</p>
      </EmptyState>
    );
  }

  return (
    <ul className="alert-list">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} showPond={showPond} onAcknowledge={onAcknowledge} />
      ))}
    </ul>
  );
}

import { useNow } from '../hooks/useNow.js';
import { formatDateTime, formatRelative } from '../lib/format.js';
import { EmptyState } from './StateViews.jsx';
import { StatusBadge } from './StatusBadge.jsx';

/** Kuat sinyal WiFi sebagai 0–4 bar: ≥ -55 dBm sangat baik, < -85 dBm buruk. */
export function signalBars(rssi) {
  if (rssi == null) return 0;
  return [-85, -75, -65, -55].filter((limit) => rssi >= limit).length;
}

function Signal({ rssi }) {
  if (rssi == null) return <span className="muted">—</span>;
  const bars = signalBars(rssi);
  return (
    <span className="signal" title={`${rssi} dBm`}>
      <span className="signal__bars" data-level={bars} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      {rssi} dBm
    </span>
  );
}

/**
 * Tabel node ESP32 beserta status koneksinya.
 *
 * @param pondNames     opsional { [pondId]: nama } untuk kolom Kolam
 * @param renderActions opsional; tombol aksi per baris (mis. ubah/hapus untuk admin)
 * @param emptyText     teks bila daftar kosong
 */
export function DeviceTable({ devices, pondNames, renderActions, emptyText = 'Belum ada device terdaftar.' }) {
  const now = useNow();

  if (!devices?.length) {
    return (
      <EmptyState icon="cpu">
        <p>{emptyText}</p>
      </EmptyState>
    );
  }

  return (
    <div className="card table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>Device</th>
            {pondNames && <th>Kolam</th>}
            <th>Status</th>
            <th>Sinyal</th>
            <th>Alamat IP</th>
            <th>Terakhir terlihat</th>
            {renderActions && <th aria-label="Aksi" />}
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id}>
              <td>
                <span className="table__primary">{device.name ?? device.id}</span>
                <span className="table__secondary">{device.id}</span>
              </td>
              {pondNames && <td>{pondNames[device.pond_id] ?? device.pond_id}</td>}
              <td>
                <StatusBadge status={device.status} />
              </td>
              <td>
                <Signal rssi={device.rssi} />
              </td>
              <td className="mono">{device.ip_address ?? '—'}</td>
              <td title={formatDateTime(device.last_seen_at)}>{formatRelative(device.last_seen_at, now)}</td>
              {renderActions && <td className="table__actions">{renderActions(device)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { StatusBadge } from './StatusBadge.jsx';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatLastSeen(value) {
  if (!value) return 'Belum pernah';
  return dateFormatter.format(new Date(value));
}

/**
 * Tabel daftar node ESP32 beserta status koneksinya.
 *
 * @param renderActions opsional; tombol aksi per baris (mis. ubah/hapus untuk admin)
 */
export function DeviceTable({ devices, renderActions }) {
  if (!devices?.length) {
    return <p className="state state--empty">Belum ada device terdaftar.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>Device</th>
            <th>Kolam</th>
            <th>Status</th>
            <th>Sinyal</th>
            <th>Alamat IP</th>
            <th>Terakhir Terlihat</th>
            {renderActions && <th />}
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id}>
              <td>
                <span className="table__primary">{device.name ?? device.id}</span>
                <span className="table__secondary">{device.id}</span>
              </td>
              <td>{device.pond_id}</td>
              <td>
                <StatusBadge status={device.status} />
              </td>
              <td>{device.rssi != null ? `${device.rssi} dBm` : '-'}</td>
              <td>{device.ip_address ?? '-'}</td>
              <td>{formatLastSeen(device.last_seen_at)}</td>
              {renderActions && <td className="table__actions">{renderActions(device)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

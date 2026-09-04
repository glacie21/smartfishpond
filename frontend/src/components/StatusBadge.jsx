const LABELS = {
  online: 'Online',
  offline: 'Offline',
  normal: 'Normal',
  warning: 'Waspada',
  critical: 'Kritis',
  unknown: 'Tidak ada data',
};

/** Lencana status kecil; warnanya diatur lewat kelas CSS `badge--<status>`. */
export function StatusBadge({ status, children }) {
  return (
    <span className={`badge badge--${status}`}>
      <span className="badge__dot" aria-hidden="true" />
      {children ?? LABELS[status] ?? status}
    </span>
  );
}

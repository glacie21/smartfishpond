/** Tampilan saat data sedang dimuat. */
export function Loading({ label = 'Memuat data...' }) {
  return (
    <div className="state state--loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

/** Tampilan error dengan tombol coba lagi. */
export function ErrorState({ message, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Coba lagi
        </button>
      )}
    </div>
  );
}

/** Tampilan saat data kosong. */
export function EmptyState({ children }) {
  return <div className="state state--empty">{children}</div>;
}

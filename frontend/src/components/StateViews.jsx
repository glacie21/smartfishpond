import { Component } from 'react';

import { Icon } from './Icon.jsx';

/** Tampilan saat data sedang dimuat. */
export function Loading({ label = 'Memuat data...' }) {
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

/** Kerangka abu-abu berdenyut selagi kartu dimuat. */
export function Skeleton({ count = 3, height = 140 }) {
  return (
    <div className="card-grid" role="status" aria-label="Memuat">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

/** Tampilan error dengan tombol coba lagi. */
export function ErrorState({ message, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <Icon name="alert" size={28} />
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={() => onRetry()}>
          <Icon name="refresh" size={16} /> Coba lagi
        </button>
      )}
    </div>
  );
}

/** Tampilan saat data kosong. */
export function EmptyState({ icon = 'droplet', title, children }) {
  return (
    <div className="state">
      <span className="state__icon">
        <Icon name={icon} size={26} />
      </span>
      {title && <h3 className="state__title">{title}</h3>}
      {children}
    </div>
  );
}

/**
 * Menangkap error render agar satu halaman yang rusak tidak membuat seluruh
 * aplikasi blank. Diberi `key` lokasi agar pindah halaman me-reset-nya.
 */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <ErrorState
        message={`Terjadi kesalahan saat menampilkan halaman: ${this.state.error.message}`}
        onRetry={() => this.setState({ error: null })}
      />
    );
  }
}

import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="state state--empty">
      <div style={{ fontSize: '3rem', marginBottom: 8 }}>🌊</div>
      <h2>Halaman tidak ditemukan</h2>
      <p className="state__hint">
        Halaman yang Anda cari tidak ada atau telah dipindahkan.
      </p>
      <Link to="/" className="btn">
        ← Kembali ke dashboard
      </Link>
    </div>
  );
}

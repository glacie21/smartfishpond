import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="state state--empty">
      <h2>Halaman tidak ditemukan</h2>
      <Link to="/" className="btn">
        Kembali ke dashboard
      </Link>
    </div>
  );
}

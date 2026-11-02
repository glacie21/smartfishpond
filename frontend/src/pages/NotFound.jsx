import { Link } from 'react-router-dom';

import { Icon } from '../components/Icon.jsx';
import { EmptyState } from '../components/StateViews.jsx';

export function NotFound() {
  return (
    <EmptyState icon="waves" title="Halaman tidak ditemukan">
      <p className="state__hint">Halaman yang Anda cari tidak ada atau telah dipindahkan.</p>
      <Link to="/" className="btn">
        <Icon name="back" size={16} /> Kembali ke dashboard
      </Link>
    </EmptyState>
  );
}

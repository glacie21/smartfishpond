import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { Loading } from './StateViews.jsx';

/** Membungkus route yang wajib login; tamu diarahkan ke /login. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') return <Loading label="Memeriksa sesi..." />;
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

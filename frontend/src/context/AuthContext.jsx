import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '../api/client.js';
import { clearToken, getToken, onSessionExpired, setToken } from '../api/session.js';
import { disconnectSocket } from '../api/socket.js';

const AuthContext = createContext(null);

/**
 * Menyimpan user yang sedang login.
 *
 * status: 'checking' (memvalidasi token tersimpan) | 'authenticated' | 'anonymous'
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => (getToken() ? 'checking' : 'anonymous'));
  // Pesan untuk halaman login, mis. "Sesi berakhir, silakan login ulang".
  const [notice, setNotice] = useState(null);

  // Token tersimpan belum tentu masih berlaku: tanyakan ke server.
  useEffect(() => {
    if (status !== 'checking') return;
    api
      .me()
      .then((me) => {
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => setStatus('anonymous'));
  }, [status]);

  useEffect(
    () =>
      onSessionExpired((message) => {
        disconnectSocket();
        setUser(null);
        setStatus('anonymous');
        setNotice(message);
      }),
    [],
  );

  const login = useCallback(async (username, password) => {
    const { token, user: me } = await api.login(username, password);
    setToken(token);
    setUser(me);
    setNotice(null);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => {
    clearToken();
    disconnectSocket();
    setUser(null);
    setNotice(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo(
    () => ({ user, status, notice, login, logout }),
    [user, status, notice, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return context;
}

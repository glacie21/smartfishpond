const TOKEN_KEY = 'fishpond.token';

const listeners = new Set();

/**
 * Token JWT disimpan di localStorage agar sesi bertahan saat halaman
 * di-refresh. Konsekuensinya, aplikasi ini tidak boleh memuat skrip pihak
 * ketiga yang tidak dipercaya (XSS bisa membaca localStorage).
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Dipanggil API client saat server membalas 401: sesi tidak berlaku lagi. */
export function notifySessionExpired(message) {
  clearToken();
  for (const listener of listeners) listener(message);
}

/** Berlangganan event sesi berakhir; mengembalikan fungsi untuk berhenti. */
export function onSessionExpired(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

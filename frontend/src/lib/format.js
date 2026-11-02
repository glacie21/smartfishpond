/** Formatter tanggal/waktu bersama — dibuat sekali, dipakai seluruh aplikasi. */
const dateTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
const clock = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });
const dayClock = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatDateTime = (value) => (value ? dateTime.format(new Date(value)) : '—');
export const formatClock = (value) => clock.format(new Date(value));
export const formatDayClock = (value) => dayClock.format(new Date(value));

/** Durasi singkat: "12 mnt", "3 jam 5 mnt", "2 hari". */
export function formatDuration(from, to = Date.now()) {
  const minutes = Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000));
  if (minutes < 60) return `${minutes} mnt`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} jam${minutes % 60 ? ` ${minutes % 60} mnt` : ''}`;
  return `${Math.floor(hours / 24)} hari`;
}

/** Waktu relatif: "baru saja", "5 mnt lalu", "2 jam lalu", lalu tanggal lengkap. */
export function formatRelative(value, now = Date.now()) {
  if (!value) return 'belum pernah';
  const seconds = Math.round((now - new Date(value)) / 1000);
  if (seconds < 45) return 'baru saja';
  if (seconds < 3600) return `${Math.round(seconds / 60)} mnt lalu`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
  return formatDateTime(value);
}

/** Data dianggap basi bila pembacaan terakhir lebih tua dari batas ini. */
export const STALE_AFTER_MS = 10 * 60 * 1000;
export const isStale = (value, now = Date.now()) => !value || now - new Date(value) > STALE_AFTER_MS;

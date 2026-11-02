import { useEffect, useState } from 'react';

/** Waktu sekarang yang diperbarui berkala — agar teks "5 mnt lalu" tetap akurat. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

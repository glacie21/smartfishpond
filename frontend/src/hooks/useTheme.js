import { useEffect, useState } from 'react';

const STORAGE_KEY = 'fishpond.theme';
export const THEMES = ['system', 'light', 'dark'];

const lightQuery = () => window.matchMedia?.('(prefers-color-scheme: light)');

/** Menerapkan tema ke <html data-theme>; skrip kecil di index.html melakukan hal sama sebelum render. */
function applyTheme(preference) {
  const theme = preference === 'system' ? (lightQuery()?.matches ? 'light' : 'dark') : preference;
  document.documentElement.dataset.theme = theme;
}

/** Preferensi tema (system | light | dark), disimpan di localStorage. */
export function useTheme() {
  const [preference, setPreference] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(saved) ? saved : 'system';
  });

  useEffect(() => {
    applyTheme(preference);
    localStorage.setItem(STORAGE_KEY, preference);
    if (preference !== 'system') return undefined;

    // Ikuti perubahan tema OS secara langsung.
    const query = lightQuery();
    const onChange = () => applyTheme('system');
    query?.addEventListener('change', onChange);
    return () => query?.removeEventListener('change', onChange);
  }, [preference]);

  /** Berputar: system → light → dark → system. */
  const cycle = () => setPreference((p) => THEMES[(THEMES.indexOf(p) + 1) % THEMES.length]);
  return { preference, cycle };
}

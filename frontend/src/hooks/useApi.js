import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Memanggil fungsi API sekali (dan tiap kali `deps` berubah), lengkap
 * dengan state loading/error, `refetch`, dan `setData` untuk pembaruan lokal.
 *
 * Hanya respons request TERAKHIR yang dipakai: bila pengguna cepat berganti
 * rentang waktu, respons lama yang datang belakangan tidak menimpa yang baru.
 *
 * @param apiCall fungsi yang mengembalikan Promise
 * @param deps    dependency array — pemicu request ulang
 */
export function useApi(apiCall, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const latest = useRef(0);

  // apiCall biasanya fungsi inline yang baru tiap render; simpan versi
  // terbarunya di ref agar request hanya diulang saat `deps` berubah.
  const apiCallRef = useRef(apiCall);
  apiCallRef.current = apiCall;

  /** `silent`: muat ulang di latar tanpa menampilkan loading. */
  const execute = useCallback(async ({ silent = false } = {}) => {
    const id = ++latest.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiCallRef.current();
      if (id === latest.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (id === latest.current) setState((s) => ({ ...s, loading: false, error: err.message }));
    }
    // `deps` dari pemanggil, seperti useEffect; tidak bisa dicek statis oleh linter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  // Unmount: abaikan respons yang masih dalam perjalanan.
  useEffect(() => () => void latest.current++, []);

  const setData = useCallback((update) => {
    setState((s) => ({ ...s, data: typeof update === 'function' ? update(s.data) : update }));
  }, []);

  return { ...state, refetch: execute, setData };
}

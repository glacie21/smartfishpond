import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Memanggil fungsi API sekali (dan tiap kali `deps` berubah),
 * lengkap dengan state loading/error dan fungsi `refetch`.
 *
 * @param apiCall fungsi yang mengembalikan Promise
 * @param deps    dependency array — pemicu request ulang
 */
export function useApi(apiCall, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Menghindari setState pada komponen yang sudah unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // apiCall biasanya fungsi inline yang baru tiap render; simpan versi
  // terbarunya di ref agar request hanya diulang saat `deps` berubah.
  const apiCallRef = useRef(apiCall);
  apiCallRef.current = apiCall;

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiCallRef.current();
      if (mountedRef.current) setData(result);
    } catch (err) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // `deps` dari pemanggil, seperti useEffect; tidak bisa dicek statis oleh linter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

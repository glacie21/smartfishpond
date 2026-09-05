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

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiCall();
      if (mountedRef.current) setData(result);
    } catch (err) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

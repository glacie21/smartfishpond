import { useCallback, useRef, useState } from 'react';

/**
 * State `busy`/`error` untuk aksi async dari tombol atau form (simpan,
 * hapus, kirim perintah). `run` mengembalikan hasil aksi, atau `undefined`
 * bila gagal — pesan errornya tersedia di `error`.
 */
export function useAction(action) {
  const [state, setState] = useState({ busy: false, error: null });
  const actionRef = useRef(action);
  actionRef.current = action;

  const run = useCallback(async (...args) => {
    setState({ busy: true, error: null });
    try {
      const result = await actionRef.current(...args);
      setState({ busy: false, error: null });
      return result;
    } catch (err) {
      setState({ busy: false, error: err.message });
      return undefined;
    }
  }, []);

  return { ...state, run };
}

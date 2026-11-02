import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useApi } from './useApi.js';

/** Promise yang bisa diselesaikan dari luar. */
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

describe('useApi', () => {
  it('respons lama yang datang belakangan tidak menimpa respons baru', async () => {
    const slow = deferred();
    const fast = deferred();
    const { result, rerender } = renderHook(({ call, key }) => useApi(call, [key]), {
      initialProps: { call: () => slow.promise, key: '24h' },
    });

    rerender({ call: () => fast.promise, key: '1h' });
    await act(async () => fast.resolve('data 1 jam'));
    await act(async () => slow.resolve('data 24 jam'));

    expect(result.current.data).toBe('data 1 jam');
    expect(result.current.loading).toBe(false);
  });

  it('refetch senyap tidak menyalakan loading', async () => {
    let n = 0;
    const { result } = renderHook(() => useApi(async () => ++n, []));
    await waitFor(() => expect(result.current.data).toBe(1));

    let pending;
    act(() => {
      pending = result.current.refetch({ silent: true });
    });
    expect(result.current.loading).toBe(false);
    await act(() => pending);
    expect(result.current.data).toBe(2);
  });

  it('menyimpan pesan error', async () => {
    const { result } = renderHook(() => useApi(() => Promise.reject(new Error('Server mati')), []));
    await waitFor(() => expect(result.current.error).toBe('Server mati'));
  });
});

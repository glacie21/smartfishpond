import { describe, expect, it } from 'vitest';

import { newest } from './PondDetail.jsx';

describe('newest', () => {
  it('memilih pembacaan terbaru antar device, bukan device pertama', () => {
    const a = { device_id: 'a', recorded_at: '2026-11-02T10:00:00Z' };
    const b = { device_id: 'b', recorded_at: '2026-11-02T10:05:00Z' };
    expect(newest(a, b)).toBe(b);
    expect(newest(b, a)).toBe(b);
  });

  it('mengabaikan kandidat kosong', () => {
    const a = { recorded_at: '2026-11-02T10:00:00Z' };
    expect(newest(null, a)).toBe(a);
    expect(newest(null)).toBeNull();
    expect(newest()).toBeNull();
  });
});

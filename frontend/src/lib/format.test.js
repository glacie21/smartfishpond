import { describe, expect, it } from 'vitest';

import { formatDuration, formatRelative, isStale } from './format.js';

const now = new Date('2026-11-02T10:00:00Z').getTime();
const ago = (ms) => new Date(now - ms).toISOString();

describe('formatDuration', () => {
  it('menit, jam+menit, lalu hari', () => {
    expect(formatDuration(ago(12 * 60e3), now)).toBe('12 mnt');
    expect(formatDuration(ago(185 * 60e3), now)).toBe('3 jam 5 mnt');
    expect(formatDuration(ago(120 * 60e3), now)).toBe('2 jam');
    expect(formatDuration(ago(3 * 86400e3), now)).toBe('3 hari');
  });
});

describe('formatRelative', () => {
  it('menyebut "baru saja", menit, dan jam yang lalu', () => {
    expect(formatRelative(ago(10e3), now)).toBe('baru saja');
    expect(formatRelative(ago(5 * 60e3), now)).toBe('5 mnt lalu');
    expect(formatRelative(ago(2 * 3600e3), now)).toBe('2 jam lalu');
  });

  it('nilai kosong berarti belum pernah', () => {
    expect(formatRelative(null, now)).toBe('belum pernah');
  });
});

describe('isStale', () => {
  it('basi setelah 10 menit atau bila tidak ada data', () => {
    expect(isStale(ago(60e3), now)).toBe(false);
    expect(isStale(ago(11 * 60e3), now)).toBe(true);
    expect(isStale(null, now)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import { evaluateMetric, formatMetric, rangeFor } from './metrics.js';

describe('rangeFor', () => {
  it('memakai ambang dari server bila ada', () => {
    const thresholds = { temperature: { min: 27, max: 30, source: 'pond' } };
    expect(rangeFor('temperature', thresholds)).toEqual([27, 30]);
  });

  it('jatuh ke rentang bawaan bila server tidak menyediakan', () => {
    expect(rangeFor('dissolved_oxygen', {})).toEqual([5, 12]);
    expect(rangeFor('dissolved_oxygen')).toEqual([5, 12]);
  });

  it('mengubah nilai string (NUMERIC dari API) menjadi angka', () => {
    expect(rangeFor('ph', { ph: { min: '6.5', max: '8.5' } })).toEqual([6.5, 8.5]);
  });
});

describe('evaluateMetric — sama dengan aturan backend', () => {
  it.each([
    [7, 'normal'],
    [5, 'normal'],      // batas inklusif
    [4.5, 'warning'],   // selisih 0,5 <= 15% x 7 = 1,05
    [3, 'critical'],    // selisih 2 > 1,05
    [13.5, 'critical'],
  ])('DO %s mg/L -> %s', (value, expected) => {
    expect(evaluateMetric('dissolved_oxygen', value)).toBe(expected);
  });

  it('memakai rentang khusus kolam bila diberikan', () => {
    expect(evaluateMetric('temperature', 28, [26, 32])).toBe('normal');
    expect(evaluateMetric('temperature', 28, [29, 31])).toBe('critical');
  });

  it('nilai kosong atau metrik tak dikenal -> unknown', () => {
    expect(evaluateMetric('ph', null)).toBe('unknown');
    expect(evaluateMetric('ph', undefined)).toBe('unknown');
    expect(evaluateMetric('salinitas', 3)).toBe('unknown');
  });
});

describe('formatMetric', () => {
  it('membulatkan sesuai jumlah desimal metrik', () => {
    expect(formatMetric('ph', 7.256)).toBe('7.26');
    expect(formatMetric('tds', 312.7)).toBe('313');
  });

  it('menampilkan tanda pisah untuk nilai kosong', () => {
    expect(formatMetric('ph', null)).toBe('—');
  });
});

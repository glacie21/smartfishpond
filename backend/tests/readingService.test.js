import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/repositories/readingRepository.js', () => ({
  findAggregated: vi.fn(async () => []),
  findAggregatedFromHourly: vi.fn(async () => []),
}));

const { getAggregated } = await import('../src/services/readingService.js');
const readingRepository = await import('../src/repositories/readingRepository.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAggregated — sumber data', () => {
  it.each(['1 hour', '6 hours', '1 day'])('bucket %s dibaca dari rollup per jam', async (bucket) => {
    await getAggregated({ pondId: 'pond-01', bucket });
    expect(readingRepository.findAggregatedFromHourly).toHaveBeenCalledWith(
      expect.objectContaining({ pondId: 'pond-01', bucket }),
    );
    expect(readingRepository.findAggregated).not.toHaveBeenCalled();
  });

  it.each(['5 minutes', '15 minutes', '30 minutes'])('bucket %s dibaca dari data mentah', async (bucket) => {
    await getAggregated({ pondId: 'pond-01', bucket });
    expect(readingRepository.findAggregated).toHaveBeenCalled();
    expect(readingRepository.findAggregatedFromHourly).not.toHaveBeenCalled();
  });

  it('menolak bucket di luar daftar (nilainya masuk ke SQL)', () => {
    expect(() => getAggregated({ bucket: "1 hour'; DROP TABLE readings; --" })).toThrow(/tidak didukung/);
  });
});

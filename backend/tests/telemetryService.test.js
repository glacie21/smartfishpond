import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/repositories/deviceRepository.js', () => ({
  findById: vi.fn(),
  ensureExists: vi.fn(async (id, pondId) => ({ id, pond_id: pondId })),
  updateStatus: vi.fn(async (id) => ({ id })),
}));
vi.mock('../src/repositories/pondRepository.js', () => ({
  ensureExists: vi.fn(),
}));
vi.mock('../src/repositories/readingRepository.js', () => ({
  insert: vi.fn(async (r) => ({ device_id: r.deviceId, pond_id: r.pondId })),
}));
vi.mock('../src/services/alertService.js', () => ({
  evaluateReading: vi.fn(async () => undefined),
  resolveDeviceOffline: vi.fn(async () => undefined),
}));
vi.mock('../src/realtime/socket.js', () => ({ broadcast: vi.fn(), broadcastAll: vi.fn() }));

const { ingestTelemetry } = await import('../src/services/telemetryService.js');
const deviceRepository = await import('../src/repositories/deviceRepository.js');
const pondRepository = await import('../src/repositories/pondRepository.js');
const readingRepository = await import('../src/repositories/readingRepository.js');
const alertService = await import('../src/services/alertService.js');

const packet = (pondId) => ({
  deviceId: 'esp32-node-01',
  pondId,
  metrics: { ph: 7.1 },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ingestTelemetry — kunci kolam', () => {
  it('mendaftarkan device baru beserta kolamnya', async () => {
    deviceRepository.findById.mockResolvedValue(null);
    await ingestTelemetry(packet('pond-01'));

    expect(pondRepository.ensureExists).toHaveBeenCalledWith('pond-01');
    expect(deviceRepository.ensureExists).toHaveBeenCalledWith('esp32-node-01', 'pond-01');
    expect(readingRepository.insert).toHaveBeenCalled();
    expect(alertService.evaluateReading).toHaveBeenCalled();
  });

  it('menolak paket dari kolam yang bukan kolam terdaftar device', async () => {
    deviceRepository.findById.mockResolvedValue({ id: 'esp32-node-01', pond_id: 'pond-01' });

    await expect(ingestTelemetry(packet('pond-02'))).rejects.toThrow(/terdaftar di kolam "pond-01"/);
    expect(pondRepository.ensureExists).not.toHaveBeenCalled();
    expect(readingRepository.insert).not.toHaveBeenCalled();
  });

  it('kegagalan evaluasi alert tidak membatalkan penyimpanan data', async () => {
    deviceRepository.findById.mockResolvedValue({ id: 'esp32-node-01', pond_id: 'pond-01' });
    alertService.evaluateReading.mockRejectedValueOnce(new Error('db putus'));

    await expect(ingestTelemetry(packet('pond-01'))).resolves.toBeTruthy();
    expect(readingRepository.insert).toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/repositories/alertRepository.js', () => ({
  findOpenByDevice: vi.fn(async () => []),
  create: vi.fn(async (alert) => ({ id: 1, ...alert })),
  update: vi.fn(async (id, patch) => ({ id, ...patch })),
  resolve: vi.fn(async (id) => ({ id, resolved_at: new Date().toISOString() })),
}));
vi.mock('../src/services/thresholdService.js', () => ({
  getEffective: vi.fn(async () => ({ dissolved_oxygen: { min: 5, max: 12, source: 'default' } })),
}));
vi.mock('../src/services/notificationService.js', () => ({
  notifyAlert: vi.fn(async () => undefined),
}));
vi.mock('../src/realtime/socket.js', () => ({
  broadcast: vi.fn(),
  broadcastAll: vi.fn(),
}));

const alertService = await import('../src/services/alertService.js');
const alertRepository = await import('../src/repositories/alertRepository.js');
const { notifyAlert } = await import('../src/services/notificationService.js');
const { evaluateValue, isClearOf } = await import('../src/services/metrics.js');

const reading = (dissolvedOxygen) => ({
  device_id: 'esp32-node-01',
  pond_id: 'pond-01',
  dissolved_oxygen: dissolvedOxygen,
});

beforeEach(() => {
  vi.clearAllMocks();
  alertRepository.findOpenByDevice.mockResolvedValue([]);
  alertService.resetPendingViolations();
});

describe('evaluateValue', () => {
  it('membedakan normal, waspada, dan kritis (batas 15% lebar rentang)', () => {
    expect(evaluateValue(7, [5, 12])).toBe('normal');
    expect(evaluateValue(4.5, [5, 12])).toBe('warning'); // selisih 0,5 < 1,05
    expect(evaluateValue(3, [5, 12])).toBe('critical'); // selisih 2 > 1,05
  });

  it('hysteresis: nilai tepat di batas belum dianggap pulih', () => {
    expect(isClearOf(5.1, [5, 12], 'low')).toBe(false);
    expect(isClearOf(5.5, [5, 12], 'low')).toBe(true);
    // Sisi atas tidak terpengaruh margin sisi bawah (mis. kekeruhan [0, 50]).
    expect(isClearOf(1, [0, 50], 'high')).toBe(true);
  });
});

describe('alertService.evaluateReading', () => {
  it('menunggu konfirmasi: satu pembacaan buruk belum membuka alert', async () => {
    await alertService.evaluateReading(reading(3));
    expect(alertRepository.create).not.toHaveBeenCalled();

    await alertService.evaluateReading(reading(3));
    expect(alertRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'dissolved_oxygen', severity: 'critical', value: 3 }),
    );
    expect(notifyAlert).toHaveBeenCalledWith('opened', expect.anything());
  });

  it('pembacaan normal di antaranya mereset hitungan konfirmasi', async () => {
    await alertService.evaluateReading(reading(3));
    await alertService.evaluateReading(reading(7));
    await alertService.evaluateReading(reading(3));
    expect(alertRepository.create).not.toHaveBeenCalled();
  });

  it('meningkatkan alert waspada menjadi kritis dan memberi notifikasi', async () => {
    alertRepository.findOpenByDevice.mockResolvedValue([
      { id: 9, type: 'metric', metric: 'dissolved_oxygen', severity: 'warning', value: 4.5, min_value: 5 },
    ]);
    await alertService.evaluateReading(reading(3));

    expect(alertRepository.update).toHaveBeenCalledWith(9, expect.objectContaining({ severity: 'critical' }));
    expect(notifyAlert).toHaveBeenCalledWith('escalated', expect.anything());
  });

  it('tidak memberi notifikasi ulang bila severity tidak berubah', async () => {
    alertRepository.findOpenByDevice.mockResolvedValue([
      { id: 9, type: 'metric', metric: 'dissolved_oxygen', severity: 'critical', value: 3, min_value: 5 },
    ]);
    await alertService.evaluateReading(reading(2.8));

    expect(alertRepository.update).toHaveBeenCalledWith(9, expect.objectContaining({ severity: undefined }));
    expect(notifyAlert).not.toHaveBeenCalled();
  });

  it('menutup alert hanya setelah nilai melewati margin hysteresis', async () => {
    const open = { id: 9, type: 'metric', metric: 'dissolved_oxygen', severity: 'warning', value: 4.5, min_value: 5 };
    alertRepository.findOpenByDevice.mockResolvedValue([open]);

    await alertService.evaluateReading(reading(5.1));
    expect(alertRepository.resolve).not.toHaveBeenCalled();

    await alertService.evaluateReading(reading(6));
    expect(alertRepository.resolve).toHaveBeenCalledWith(9);
    expect(notifyAlert).toHaveBeenCalledWith('resolved', expect.anything());
  });

  it('telemetri masuk menutup alert device offline', async () => {
    alertRepository.findOpenByDevice.mockResolvedValue([{ id: 4, type: 'device_offline' }]);
    await alertService.evaluateReading(reading(7));
    expect(alertRepository.resolve).toHaveBeenCalledWith(4);
  });

  it('metrik null (sensor gagal) tidak mengubah apa pun', async () => {
    await alertService.evaluateReading(reading(null));
    await alertService.evaluateReading(reading(null));
    expect(alertRepository.create).not.toHaveBeenCalled();
    expect(alertRepository.resolve).not.toHaveBeenCalled();
  });
});

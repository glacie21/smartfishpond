import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/repositories/deviceRepository.js', () => ({
  findAll: vi.fn(async () => []),
  findById: vi.fn(),
  updateActuators: vi.fn(),
}));
vi.mock('../src/repositories/commandRepository.js', () => ({
  create: vi.fn(async (c) => ({ id: '0b5a1f4e-2c7d-4a8b-9e3f-1d2c3b4a5f60', status: 'sent', ...c })),
  markFailed: vi.fn(),
  markAcked: vi.fn(),
}));
vi.mock('../src/mqtt/client.js', () => ({
  publishJson: vi.fn(async () => undefined),
  getMqttClient: vi.fn(() => null),
}));
vi.mock('../src/realtime/socket.js', () => ({ broadcast: vi.fn(), broadcastAll: vi.fn() }));

const { createApp } = await import('../src/app.js');
const { signToken } = await import('../src/services/authService.js');
const { ingestCommandAck } = await import('../src/services/deviceControlService.js');
const deviceRepository = await import('../src/repositories/deviceRepository.js');
const commandRepository = await import('../src/repositories/commandRepository.js');
const { publishJson } = await import('../src/mqtt/client.js');

const app = createApp();
const admin = `Bearer ${signToken({ id: 1, username: 'admin', role: 'admin' })}`;
const viewer = `Bearer ${signToken({ id: 2, username: 'viewer', role: 'viewer' })}`;

const sendCommand = (auth, body) =>
  request(app).post('/api/devices/esp32-node-01/commands').set('Authorization', auth).send(body);

beforeEach(() => {
  vi.clearAllMocks();
  deviceRepository.findById.mockResolvedValue({
    id: 'esp32-node-01',
    pond_id: 'pond-01',
    status: 'online',
  });
});

describe('POST /api/devices/:id/commands', () => {
  it('mengirim perintah ke topik command milik device', async () => {
    const res = await sendCommand(admin, { actuator: 'aerator', state: true, durationS: 600 });

    expect(res.status).toBe(202);
    expect(publishJson).toHaveBeenCalledWith(
      'fishpond/pond-01/esp32-node-01/command',
      expect.objectContaining({ actuator: 'aerator', state: true, durationS: 600, id: res.body.data.id }),
    );
    expect(commandRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ requestedBy: 'admin' }),
    );
  });

  it('melarang viewer mengendalikan aktuator', async () => {
    const res = await sendCommand(viewer, { actuator: 'aerator', state: true });
    expect(res.status).toBe(403);
    expect(publishJson).not.toHaveBeenCalled();
  });

  it('menolak aktuator yang tidak dikenal', async () => {
    const res = await sendCommand(admin, { actuator: 'pemanas', state: true });
    expect(res.status).toBe(400);
  });

  it('menolak perintah ke device offline dengan 409', async () => {
    deviceRepository.findById.mockResolvedValue({ id: 'esp32-node-01', pond_id: 'pond-01', status: 'offline' });
    const res = await sendCommand(admin, { actuator: 'pump', state: false });
    expect(res.status).toBe(409);
    expect(publishJson).not.toHaveBeenCalled();
  });

  it('menandai perintah gagal bila broker tidak tersambung', async () => {
    publishJson.mockRejectedValueOnce(new Error('Broker MQTT tidak tersambung'));
    const res = await sendCommand(admin, { actuator: 'feeder', state: true, durationS: 10 });
    expect(res.status).toBe(503);
    expect(commandRepository.markFailed).toHaveBeenCalled();
  });
});

describe('ingestCommandAck', () => {
  it('menolak id perintah yang bukan UUID', async () => {
    await expect(
      ingestCommandAck({ id: '1; DROP TABLE', ok: true }, { deviceId: 'esp32-node-01', pondId: 'pond-01' }),
    ).rejects.toThrow(/ack tidak valid/);
    expect(commandRepository.markAcked).not.toHaveBeenCalled();
  });

  it('mencocokkan ack dengan device pengirim', async () => {
    const id = '0b5a1f4e-2c7d-4a8b-9e3f-1d2c3b4a5f60';
    await ingestCommandAck({ id, ok: true }, { deviceId: 'esp32-node-01', pondId: 'pond-01' });
    expect(commandRepository.markAcked).toHaveBeenCalledWith(id, 'esp32-node-01', expect.objectContaining({ ok: true }));
  });
});

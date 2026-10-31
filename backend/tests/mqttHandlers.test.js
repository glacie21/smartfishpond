import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/telemetryService.js', () => ({
  ingestTelemetry: vi.fn(async () => undefined),
  ingestStatus: vi.fn(async () => undefined),
}));
vi.mock('../src/services/deviceControlService.js', () => ({
  ingestActuatorState: vi.fn(async () => undefined),
  ingestCommandAck: vi.fn(async () => undefined),
}));

const { handleMessage } = await import('../src/mqtt/handlers.js');
const { ingestStatus, ingestTelemetry } = await import('../src/services/telemetryService.js');
const { ingestActuatorState, ingestCommandAck } = await import(
  '../src/services/deviceControlService.js'
);

const TOPIC = 'fishpond/pond-01/esp32-node-01/telemetry';
const toBuffer = (value) => Buffer.from(JSON.stringify(value));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleMessage — identitas device', () => {
  it('memakai identitas dari topik bila payload tidak menyebutkannya', async () => {
    await handleMessage(TOPIC, toBuffer({ metrics: { ph: 7 } }));
    expect(ingestTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ deviceId: 'esp32-node-01', pondId: 'pond-01' }),
    );
  });

  it('menolak payload yang mengaku sebagai device lain', async () => {
    await handleMessage(TOPIC, toBuffer({ deviceId: 'esp32-node-02', metrics: { ph: 7 } }));
    expect(ingestTelemetry).not.toHaveBeenCalled();
  });

  it('menolak payload yang mengaku berada di kolam lain', async () => {
    await handleMessage(
      'fishpond/pond-01/esp32-node-01/status',
      toBuffer({ status: 'online', pondId: 'pond-02' }),
    );
    expect(ingestStatus).not.toHaveBeenCalled();
  });

  it('mengabaikan payload JSON yang bukan objek', async () => {
    await handleMessage(TOPIC, toBuffer(null));
    await handleMessage(TOPIC, toBuffer([1, 2]));
    expect(ingestTelemetry).not.toHaveBeenCalled();
  });
});

describe('handleMessage — topik kontrol aktuator', () => {
  const ids = { deviceId: 'esp32-node-01', pondId: 'pond-01' };

  it('meneruskan status relay dari topik actuators', async () => {
    await handleMessage('fishpond/pond-01/esp32-node-01/actuators', toBuffer({ aerator: true }));
    expect(ingestActuatorState).toHaveBeenCalledWith(expect.objectContaining({ aerator: true }), ids);
  });

  it('meneruskan balasan perintah dari topik ack', async () => {
    const ack = { id: '0b5a1f4e-2c7d-4a8b-9e3f-1d2c3b4a5f60', ok: true };
    await handleMessage('fishpond/pond-01/esp32-node-01/ack', toBuffer(ack));
    expect(ingestCommandAck).toHaveBeenCalledWith(expect.objectContaining(ack), ids);
  });
});

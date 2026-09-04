import { describe, expect, it } from 'vitest';

import { telemetryPayloadSchema } from '../src/services/telemetrySchema.js';
import { parseTopic } from '../src/mqtt/topics.js';

describe('telemetryPayloadSchema', () => {
  const validPayload = {
    deviceId: 'esp32-node-01',
    pondId: 'pond-01',
    rssi: -62,
    uptime: 1200,
    metrics: {
      temperature: 28.4,
      ph: 7.2,
      tds: 310,
      dissolvedOxygen: 6.8,
      turbidity: 12.5,
      waterLevel: 95.2,
    },
  };

  it('menerima payload lengkap', () => {
    expect(telemetryPayloadSchema.safeParse(validPayload).success).toBe(true);
  });

  it('menerima metrik null ketika satu sensor gagal dibaca', () => {
    const payload = {
      ...validPayload,
      metrics: { ...validPayload.metrics, ph: null, waterLevel: null },
    };
    expect(telemetryPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('menolak payload tanpa deviceId', () => {
    const { deviceId, ...withoutDeviceId } = validPayload;
    expect(telemetryPayloadSchema.safeParse(withoutDeviceId).success).toBe(false);
  });

  it('menolak metrik berupa string', () => {
    const payload = { ...validPayload, metrics: { ...validPayload.metrics, ph: '7.2' } };
    expect(telemetryPayloadSchema.safeParse(payload).success).toBe(false);
  });
});

describe('parseTopic', () => {
  it('mengurai topik telemetri', () => {
    expect(parseTopic('fishpond/pond-01/esp32-node-01/telemetry')).toEqual({
      base: 'fishpond',
      pondId: 'pond-01',
      deviceId: 'esp32-node-01',
      kind: 'telemetry',
    });
  });

  it('mengembalikan null untuk topik dengan jumlah segmen salah', () => {
    expect(parseTopic('fishpond/pond-01/telemetry')).toBeNull();
  });
});

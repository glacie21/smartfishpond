import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/telemetryService.js', () => ({
  ingestTelemetry: vi.fn(async () => undefined),
  ingestStatus: vi.fn(async () => undefined),
}));

const { createApp } = await import('../src/app.js');
const { handleMessage } = await import('../src/mqtt/handlers.js');

const app = createApp();
// vitest.config.js: METRICS_TOKEN=test-metrics-token
const auth = 'Bearer test-metrics-token';

describe('GET /metrics', () => {
  it('menolak tanpa token yang benar', async () => {
    expect((await request(app).get('/metrics')).status).toBe(401);
    expect((await request(app).get('/metrics').set('Authorization', 'Bearer salah')).status).toBe(401);
  });

  it('tidak butuh login JWT dan memakai format Prometheus', async () => {
    const res = await request(app).get('/metrics').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('fishpond_process_cpu_seconds_total');
    expect(res.text).toContain('fishpond_mqtt_connected 0');
  });

  it('mencatat request HTTP dengan pola route, bukan URL asli', async () => {
    await request(app).get('/api/health');
    const res = await request(app).get('/metrics').set('Authorization', auth);
    expect(res.text).toMatch(/fishpond_http_request_duration_seconds_count\{[^}]*route="\/api\/health\/"/);
  });

  it('jenis topik tak dikenal dikelompokkan sebagai "other"', async () => {
    await handleMessage('fishpond/pond-01/dev-1/sembarang-123', Buffer.from('{}'));
    await handleMessage('fishpond/pond-01/dev-1/telemetry', Buffer.from('{}'));
    const res = await request(app).get('/metrics').set('Authorization', auth);

    expect(res.text).toContain('fishpond_mqtt_messages_total{kind="other",result="ignored"} 1');
    expect(res.text).toContain('fishpond_mqtt_messages_total{kind="telemetry",result="ok"} 1');
    expect(res.text).not.toContain('sembarang-123');
  });
});

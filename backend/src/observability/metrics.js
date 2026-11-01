/**
 * Metrik Prometheus. Diekspos di GET /metrics (lihat routes/metrics.js),
 * aktif hanya bila METRICS_TOKEN diisi.
 *
 * Counter/histogram diperbarui di titik kejadian (HTTP, MQTT, notifikasi).
 * Gauge yang mencerminkan isi database (device online, alert terbuka) dihitung
 * saat di-scrape agar selalu sesuai kondisi terkini.
 */
import client from 'prom-client';

import { query } from '../db/pool.js';
import { getMqttClient } from '../mqtt/client.js';

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'fishpond_' });

export const httpRequestDuration = new client.Histogram({
  name: 'fishpond_http_request_duration_seconds',
  help: 'Durasi request HTTP',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 1, 3],
  registers: [registry],
});

export const mqttMessagesTotal = new client.Counter({
  name: 'fishpond_mqtt_messages_total',
  help: 'Pesan MQTT yang diterima backend, per jenis topik dan hasil pemrosesan',
  labelNames: ['kind', 'result'], // result: ok | rejected | error | ignored
  registers: [registry],
});

export const readingsIngestedTotal = new client.Counter({
  name: 'fishpond_readings_ingested_total',
  help: 'Pembacaan telemetri yang tersimpan',
  registers: [registry],
});

export const notificationsTotal = new client.Counter({
  name: 'fishpond_notifications_total',
  help: 'Notifikasi alert yang dikirim, per kanal dan hasil',
  labelNames: ['channel', 'result'], // result: sent | failed
  registers: [registry],
});

export const commandsTotal = new client.Counter({
  name: 'fishpond_commands_total',
  help: 'Perintah aktuator, per hasil akhir',
  labelNames: ['status'], // sent | done | failed | timeout
  registers: [registry],
});

new client.Gauge({
  name: 'fishpond_mqtt_connected',
  help: '1 bila backend tersambung ke broker MQTT',
  registers: [registry],
  collect() {
    this.set(getMqttClient()?.connected ? 1 : 0);
  },
});

new client.Gauge({
  name: 'fishpond_devices',
  help: 'Jumlah device per status koneksi',
  labelNames: ['status'],
  registers: [registry],
  async collect() {
    try {
      const { rows } = await query(`SELECT status, count(*)::int AS n FROM devices GROUP BY status`);
      this.reset();
      this.set({ status: 'online' }, 0);
      this.set({ status: 'offline' }, 0);
      for (const row of rows) this.set({ status: row.status }, row.n);
    } catch {
      // Database mati: biarkan nilai lama; health check yang melaporkannya.
    }
  },
});

new client.Gauge({
  name: 'fishpond_alerts_open',
  help: 'Alert yang sedang terbuka per severity',
  labelNames: ['severity'],
  registers: [registry],
  async collect() {
    try {
      const { rows } = await query(
        `SELECT severity, count(*)::int AS n FROM alerts WHERE resolved_at IS NULL GROUP BY severity`,
      );
      this.reset();
      this.set({ severity: 'warning' }, 0);
      this.set({ severity: 'critical' }, 0);
      for (const row of rows) this.set({ severity: row.severity }, row.n);
    } catch {
      // idem
    }
  },
});

/**
 * Middleware pencatat durasi request. Label route memakai pola Express
 * (mis. /api/devices/:id), bukan URL asli, agar jumlah seri tetap kecil.
 */
export function httpMetricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    end({ method: req.method, route, status_code: res.statusCode });
  });
  next();
}

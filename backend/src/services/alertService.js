import { config } from '../config/index.js';
import { broadcastAll } from '../realtime/socket.js';
import * as alertRepository from '../repositories/alertRepository.js';
import { badRequest, notFound } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { evaluateValue, formatValue, isClearOf, METRIC_INFO, severityRank } from './metrics.js';
import { notifyAlert } from './notificationService.js';
import * as thresholdService from './thresholdService.js';

const log = createLogger('alert');

/**
 * Hitungan pelanggaran berturut-turut yang belum dikonfirmasi, per
 * `${deviceId}:${metric}`. Cukup di memori: bila backend restart, alert
 * hanya tertunda satu-dua pembacaan.
 */
const pendingViolations = new Map();

function metricMessage(metric, value, { min, max }) {
  const { label } = METRIC_INFO[metric];
  return value < min
    ? `${label} ${formatValue(metric, value)} di bawah batas aman ${formatValue(metric, min)}`
    : `${label} ${formatValue(metric, value)} di atas batas aman ${formatValue(metric, max)}`;
}

/** Menyiarkan ke dashboard lalu mengirim notifikasi, tanpa menahan pemanggil. */
function publish(event, alert) {
  if (!alert) return;
  broadcastAll(event === 'resolved' ? 'alert:resolved' : 'alert:updated', alert);
  notifyAlert(event, alert).catch((err) => log.error(`notifikasi gagal: ${err.message}`));
}

/**
 * Mengevaluasi satu baris reading yang baru tersimpan terhadap ambang
 * kolamnya: membuka, meningkatkan, atau menutup alert metrik. Telemetri yang
 * masuk juga berarti device hidup, jadi alert offline-nya ditutup.
 */
export async function evaluateReading(reading) {
  const { device_id: deviceId, pond_id: pondId } = reading;
  const [thresholds, openAlerts] = await Promise.all([
    thresholdService.getEffective(pondId),
    alertRepository.findOpenByDevice(deviceId),
  ]);

  const openOffline = openAlerts.find((a) => a.type === 'device_offline');
  if (openOffline) publish('resolved', await alertRepository.resolve(openOffline.id));

  for (const [metric, range] of Object.entries(thresholds)) {
    const value = reading[metric];
    if (value === null || value === undefined) continue; // sensor gagal: status tidak berubah

    const key = `${deviceId}:${metric}`;
    const severity = evaluateValue(value, [range.min, range.max]);
    const open = openAlerts.find((a) => a.type === 'metric' && a.metric === metric);

    if (severity === 'normal') {
      pendingViolations.delete(key);
      const side = open && open.value < open.min_value ? 'low' : 'high';
      if (open && isClearOf(value, [range.min, range.max], side)) {
        publish('resolved', await alertRepository.resolve(open.id));
      }
      continue;
    }

    const message = metricMessage(metric, value, range);

    if (open) {
      const escalated = severityRank(severity) > severityRank(open.severity);
      const updated = await alertRepository.update(open.id, {
        value,
        message,
        severity: escalated ? severity : undefined,
      });
      if (escalated) publish('escalated', updated);
      continue;
    }

    // Belum ada alert terbuka: tunggu konfirmasi beberapa pembacaan.
    const count = (pendingViolations.get(key) ?? 0) + 1;
    if (count < config.alerts.confirmReadings) {
      pendingViolations.set(key, count);
      continue;
    }
    pendingViolations.delete(key);

    const created = await alertRepository.create({
      pondId,
      deviceId,
      type: 'metric',
      metric,
      severity,
      value,
      min: range.min,
      max: range.max,
      message,
    });
    publish('opened', created);
  }
}

/** Device kembali online lewat pesan status: tutup alert offline-nya. */
export async function resolveDeviceOffline(deviceId) {
  const open = await alertRepository.findOpenByDevice(deviceId);
  const offline = open.find((a) => a.type === 'device_offline');
  if (offline) publish('resolved', await alertRepository.resolve(offline.id));
}

/** Dipanggil tugas latar: buka alert untuk device yang offline terlalu lama. */
export async function openOfflineAlerts() {
  const { offlineDelaySeconds } = config.alerts;
  const devices = await alertRepository.findDevicesNeedingOfflineAlert(offlineDelaySeconds);
  const delayText =
    offlineDelaySeconds < 60 ? `${offlineDelaySeconds} detik` : `${Math.round(offlineDelaySeconds / 60)} menit`;
  for (const device of devices) {
    const created = await alertRepository.create({
      pondId: device.pond_id,
      deviceId: device.id,
      type: 'device_offline',
      severity: 'critical',
      message: `Perangkat tidak mengirim data lebih dari ${delayText}`,
    });
    publish('opened', created);
  }
}

export function listAlerts(filter) {
  return alertRepository.findMany(filter);
}

export async function acknowledgeAlert(id, username) {
  const alert = await alertRepository.findById(id);
  if (!alert) throw notFound(`Alert #${id} tidak ditemukan`);
  if (alert.acknowledged_at) throw badRequest(`Alert #${id} sudah ditandai oleh ${alert.acknowledged_by}`);

  await alertRepository.acknowledge(id, username);
  const updated = await alertRepository.findById(id);
  broadcastAll('alert:updated', updated);
  return updated;
}

/** Untuk test. */
export function resetPendingViolations() {
  pendingViolations.clear();
}

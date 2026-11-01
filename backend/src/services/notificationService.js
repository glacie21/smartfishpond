import { config } from '../config/index.js';
import { notificationsTotal } from '../observability/metrics.js';
import { createLogger } from '../utils/logger.js';
import { severityRank } from './metrics.js';

const log = createLogger('notify');

const TELEGRAM_TIMEOUT_MS = 10_000;

const HEADLINE = {
  opened: { critical: '🔴 KRITIS', warning: '🟠 WASPADA' },
  escalated: { critical: '🔴 MEMBURUK → KRITIS', warning: '🟠 WASPADA' },
  resolved: { critical: '✅ PULIH', warning: '✅ PULIH' },
};

export function isTelegramEnabled() {
  const { botToken, chatIds } = config.notifications.telegram;
  return Boolean(botToken && chatIds.length);
}

/** Teks notifikasi polos (tanpa Markdown agar tidak perlu escape karakter). */
export function formatAlertMessage(event, alert) {
  const headline = HEADLINE[event]?.[alert.severity] ?? event;
  const where = `${alert.pond_name ?? alert.pond_id} · ${alert.device_name ?? alert.device_id}`;
  return `${headline}\n${alert.message}\n📍 ${where}`;
}

async function sendTelegram(text) {
  const { botToken, chatIds } = config.notifications.telegram;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
          signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
        });
        if (!response.ok) {
          const body = await response.text();
          log.error(`Telegram menolak pesan ke ${chatId}: ${response.status} ${body.slice(0, 200)}`);
          notificationsTotal.inc({ channel: 'telegram', result: 'failed' });
          return;
        }
        notificationsTotal.inc({ channel: 'telegram', result: 'sent' });
      } catch (err) {
        log.error(`gagal mengirim Telegram ke ${chatId}: ${err.message}`);
        notificationsTotal.inc({ channel: 'telegram', result: 'failed' });
      }
    }),
  );
}

/**
 * Mengirim notifikasi alert ke kanal yang aktif.
 * Tidak pernah melempar error: notifikasi gagal tidak boleh mengganggu ingest.
 *
 * @param event 'opened' | 'escalated' | 'resolved'
 */
export async function notifyAlert(event, alert) {
  if (severityRank(alert.severity) < severityRank(config.notifications.minSeverity)) return;

  const text = formatAlertMessage(event, alert);
  log.info(text.replace(/\n/g, ' | '));

  if (isTelegramEnabled()) await sendTelegram(text);
}

import 'dotenv/config';

/** Mengambil env wajib; melempar error saat boot bila belum diisi. */
function required(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} wajib diisi (lihat .env.example)`);
  }
  return value;
}

function int(key, fallback) {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : Number.parseInt(value, 10);
}

const isProduction = process.env.NODE_ENV === 'production';

// Hanya untuk development: token tetap valid saat server di-restart
// oleh `node --watch`. Produksi wajib memakai JWT_SECRET sendiri.
const DEV_JWT_SECRET = 'dev-only-insecure-jwt-secret-jangan-dipakai-di-produksi';

function jwtSecret() {
  const value = process.env.JWT_SECRET;
  if (value) {
    if (isProduction && value.length < 32) {
      throw new Error('JWT_SECRET minimal 32 karakter di produksi');
    }
    return value;
  }
  if (isProduction) {
    throw new Error('Environment variable JWT_SECRET wajib diisi di produksi');
  }
  console.warn('[config] JWT_SECRET kosong, memakai secret development yang TIDAK aman');
  return DEV_JWT_SECRET;
}

/** TRUST_PROXY: jumlah hop proxy (mis. 1) atau nama subnet Express ('loopback'). */
function trustProxy() {
  const value = process.env.TRUST_PROXY;
  if (!value || value === 'false') return false;
  const hops = Number(value);
  return Number.isInteger(hops) ? hops : value;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProduction,
  port: int('PORT', 4000),
  trustProxy: trustProxy(),

  db: {
    connectionString: required('DATABASE_URL'),
    poolMax: int('PG_POOL_MAX', 10),
  },

  mqtt: {
    url: process.env.MQTT_URL ?? 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clientId: `${process.env.MQTT_CLIENT_ID ?? 'fishpond-backend'}-${process.pid}`,
    topics: {
      telemetry: process.env.MQTT_TOPIC_TELEMETRY ?? 'fishpond/+/+/telemetry',
      status: process.env.MQTT_TOPIC_STATUS ?? 'fishpond/+/+/status',
      actuators: process.env.MQTT_TOPIC_ACTUATORS ?? 'fishpond/+/+/actuators',
      ack: process.env.MQTT_TOPIC_ACK ?? 'fishpond/+/+/ack',
    },
    base: process.env.MQTT_TOPIC_BASE ?? 'fishpond',
  },

  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  auth: {
    jwtSecret: jwtSecret(),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
    bcryptRounds: int('BCRYPT_ROUNDS', 12),
  },

  rateLimit: {
    windowMs: int('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    max: int('RATE_LIMIT_MAX', 600),
    loginMax: int('LOGIN_RATE_LIMIT_MAX', 10),
  },

  retention: {
    rawDays: int('RAW_RETENTION_DAYS', 90),
    // Rollup per jam jauh lebih kecil (±1/120 data mentah), jadi disimpan lebih lama.
    hourlyDays: int('HOURLY_RETENTION_DAYS', 730),
  },

  alerts: {
    // Jumlah pembacaan berturut-turut di luar batas sebelum alert dibuka,
    // agar satu lonjakan noise sensor tidak langsung memicu notifikasi.
    confirmReadings: int('ALERT_CONFIRM_READINGS', 2),
    // Device offline lebih lama dari ini baru dianggap masalah (reboot singkat diabaikan).
    offlineDelaySeconds: int('ALERT_OFFLINE_DELAY_SECONDS', 300),
  },

  notifications: {
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || undefined,
      chatIds: (process.env.TELEGRAM_CHAT_IDS ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    },
    // 'warning' = kirim semua alert; 'critical' = hanya yang kritis.
    minSeverity: process.env.NOTIFY_MIN_SEVERITY === 'critical' ? 'critical' : 'warning',
  },

  commands: {
    // Perintah tanpa ack dari device setelah sekian detik ditandai timeout.
    ackTimeoutSeconds: int('COMMAND_ACK_TIMEOUT_SECONDS', 30),
  },
};

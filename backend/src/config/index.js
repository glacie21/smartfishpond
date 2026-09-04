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

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: int('PORT', 4000),

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
    },
  },

  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  retention: {
    rawDays: int('RAW_RETENTION_DAYS', 90),
  },
};

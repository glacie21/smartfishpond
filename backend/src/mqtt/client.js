import mqtt from 'mqtt';

import { config } from '../config/index.js';
import { createLogger } from '../utils/logger.js';
import { handleMessage } from './handlers.js';

const log = createLogger('mqtt');

/** @type {import('mqtt').MqttClient | null} */
let client = null;

/**
 * Menyambung ke broker dan subscribe topik telemetri + status.
 *
 * Koneksi tidak menahan boot server: bila broker belum siap, library
 * akan mencoba ulang sendiri sementara REST API tetap melayani.
 */
export function connectMqtt() {
  const { url, username, password, clientId, topics } = config.mqtt;

  client = mqtt.connect(url, {
    clientId,
    username,
    password,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 10_000,
  });

  client.on('connect', () => {
    log.info(`terhubung ke broker ${url}`);
    const list = [topics.telemetry, topics.status];
    client.subscribe(list, { qos: 1 }, (err) => {
      if (err) log.error(`gagal subscribe: ${err.message}`);
      else log.info(`subscribe: ${list.join(', ')}`);
    });
  });

  client.on('message', (topic, payload) => {
    // handleMessage menangani error-nya sendiri; catch ini jaring terakhir.
    handleMessage(topic, payload).catch((err) =>
      log.error(`handler melempar error tak tertangani: ${err.message}`),
    );
  });

  client.on('reconnect', () => log.warn('mencoba menyambung ulang ke broker...'));
  client.on('offline', () => log.warn('koneksi broker offline'));
  client.on('error', (err) => log.error(`error koneksi: ${err.message}`));

  return client;
}

export function getMqttClient() {
  return client;
}

export async function closeMqtt() {
  if (!client) return;
  await client.endAsync();
  client = null;
  log.info('koneksi MQTT ditutup');
}

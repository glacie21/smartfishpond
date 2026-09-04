#!/usr/bin/env node
/**
 * Simulator node ESP32 — menguji backend & dashboard tanpa hardware.
 *
 * Menerbitkan telemetri berkala ke broker MQTT dengan pola nilai yang
 * menyerupai kolam sungguhan: suhu mengikuti siklus harian, pH dan DO
 * bergerak lambat, sesekali muncul lonjakan agar status "waspada" dan
 * "kritis" pada dashboard ikut teruji.
 *
 * Pemakaian:
 *   node scripts/simulate-device.js
 *   node scripts/simulate-device.js --ponds 3 --interval 5000
 *   MQTT_URL=mqtt://broker.lokal:1883 node scripts/simulate-device.js
 */
import mqtt from 'mqtt';

// ---------- Argumen CLI ----------
function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
const POND_COUNT = Number(arg('ponds', 2));
const INTERVAL_MS = Number(arg('interval', 5000));
const ANOMALY_CHANCE = Number(arg('anomaly', 0.05)); // peluang lonjakan per paket

// ---------- Utilitas ----------
const random = (min, max) => Math.random() * (max - min) + min;
const round = (value, decimals) => Number(value.toFixed(decimals));

/** State tiap node; nilai berikutnya bergerak dari nilai sekarang (random walk). */
function createNode(index) {
  const pondId = `pond-0${index + 1}`;
  return {
    pondId,
    deviceId: `esp32-sim-0${index + 1}`,
    startedAt: Date.now(),
    state: {
      ph: random(6.8, 7.6),
      tds: random(180, 380),
      dissolvedOxygen: random(6, 8.5),
      turbidity: random(5, 25),
      waterLevel: random(85, 105),
    },
  };
}

/** Menahan nilai di dalam rentang. */
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Menghasilkan pembacaan berikutnya.
 * Suhu memakai sinus 24 jam supaya grafik rentang panjang terlihat wajar.
 */
function nextReading(node) {
  const hourOfDay = new Date().getHours() + new Date().getMinutes() / 60;
  const temperature = 28 + 2.5 * Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI) + random(-0.2, 0.2);

  const s = node.state;
  s.ph = clamp(s.ph + random(-0.05, 0.05), 6.2, 8.8);
  s.tds = clamp(s.tds + random(-6, 6), 80, 700);
  s.dissolvedOxygen = clamp(s.dissolvedOxygen + random(-0.15, 0.15), 3.5, 11);
  s.turbidity = clamp(s.turbidity + random(-1.5, 1.5), 1, 90);
  s.waterLevel = clamp(s.waterLevel + random(-0.4, 0.4), 40, 130);

  // Sesekali dorong satu metrik keluar rentang aman.
  if (Math.random() < ANOMALY_CHANCE) {
    const keys = Object.keys(s);
    const key = keys[Math.floor(Math.random() * keys.length)];
    s[key] *= Math.random() < 0.5 ? 0.7 : 1.3;
    console.log(`  ! anomali disuntikkan pada ${key} (${node.deviceId})`);
  }

  return {
    temperature: round(temperature, 2),
    ph: round(s.ph, 2),
    tds: round(s.tds, 1),
    dissolvedOxygen: round(s.dissolvedOxygen, 2),
    turbidity: round(s.turbidity, 1),
    // Sesekali sensor gagal dibaca -> null, seperti perilaku firmware asli.
    waterLevel: Math.random() < 0.02 ? null : round(s.waterLevel, 1),
  };
}

// ---------- Jalankan ----------
const nodes = Array.from({ length: POND_COUNT }, (_, i) => createNode(i));
const client = mqtt.connect(MQTT_URL, { clientId: `fishpond-simulator-${process.pid}` });

client.on('connect', () => {
  console.log(`Terhubung ke ${MQTT_URL}`);
  console.log(`${nodes.length} node disimulasikan setiap ${INTERVAL_MS} ms. Ctrl+C untuk berhenti.\n`);

  // Umumkan status online (retained), meniru firmware.
  for (const node of nodes) {
    client.publish(
      `fishpond/${node.pondId}/${node.deviceId}/status`,
      JSON.stringify({
        status: 'online',
        deviceId: node.deviceId,
        pondId: node.pondId,
        ip: '192.168.1.99',
        rssi: -55,
        uptime: 0,
      }),
      { qos: 1, retain: true },
    );
  }

  setInterval(() => {
    for (const node of nodes) {
      const payload = {
        deviceId: node.deviceId,
        pondId: node.pondId,
        uptime: Math.round((Date.now() - node.startedAt) / 1000),
        rssi: Math.round(random(-75, -45)),
        metrics: nextReading(node),
      };

      client.publish(
        `fishpond/${node.pondId}/${node.deviceId}/telemetry`,
        JSON.stringify(payload),
        { qos: 1 },
      );

      const m = payload.metrics;
      console.log(
        `[${new Date().toLocaleTimeString('id-ID')}] ${node.deviceId} ` +
          `suhu=${m.temperature} pH=${m.ph} TDS=${m.tds} DO=${m.dissolvedOxygen} ` +
          `NTU=${m.turbidity} level=${m.waterLevel ?? 'null'}`,
      );
    }
  }, INTERVAL_MS);
});

client.on('error', (err) => {
  console.error(`Gagal terhubung ke broker: ${err.message}`);
  process.exit(1);
});

// Kirim status offline sebelum keluar agar dashboard langsung akurat.
process.on('SIGINT', () => {
  console.log('\nMenghentikan simulator...');
  for (const node of nodes) {
    client.publish(
      `fishpond/${node.pondId}/${node.deviceId}/status`,
      JSON.stringify({ status: 'offline', deviceId: node.deviceId, pondId: node.pondId }),
      { qos: 1, retain: true },
    );
  }
  client.end(false, () => process.exit(0));
});

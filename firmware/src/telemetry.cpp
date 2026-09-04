#include "telemetry.h"

#include <ArduinoJson.h>

#include "config.h"
#include "mqtt_client.h"
#include "wifi_manager.h"

namespace {

/** Buffer melingkar payload yang belum terkirim saat device offline. */
char buffer[OFFLINE_BUFFER_SIZE][MQTT_BUFFER_SIZE];
int head = 0;    // posisi tulis berikutnya
int count = 0;   // jumlah payload tertahan

void pushToBuffer(const char* payload) {
  strncpy(buffer[head], payload, MQTT_BUFFER_SIZE - 1);
  buffer[head][MQTT_BUFFER_SIZE - 1] = '\0';
  head = (head + 1) % OFFLINE_BUFFER_SIZE;
  if (count < OFFLINE_BUFFER_SIZE) {
    count++;
  } else {
    Serial.println("[telemetry] buffer penuh, payload terlama dibuang");
  }
}

/** Menambahkan nilai float ke JSON, atau null bila NaN. */
void setOrNull(JsonObject obj, const char* key, float value) {
  if (isnan(value)) {
    obj[key] = nullptr;
  } else {
    obj[key] = roundf(value * 100.0f) / 100.0f;  // 2 angka di belakang koma
  }
}

}  // namespace

namespace Telemetry {

size_t buildPayload(const SensorReading& reading, char* out, size_t outSize) {
  JsonDocument doc;

  doc["deviceId"] = DEVICE_ID;
  doc["pondId"] = POND_ID;
  doc["uptime"] = millis() / 1000;
  doc["rssi"] = WifiManager::rssi();

  JsonObject metrics = doc["metrics"].to<JsonObject>();
  setOrNull(metrics, "temperature", reading.temperatureC);
  setOrNull(metrics, "ph", reading.ph);
  setOrNull(metrics, "tds", reading.tdsPpm);
  setOrNull(metrics, "dissolvedOxygen", reading.doMgL);
  setOrNull(metrics, "turbidity", reading.turbidityNtu);
  setOrNull(metrics, "waterLevel", reading.waterLevelCm);

  const size_t written = serializeJson(doc, out, outSize);
  if (written == 0 || written >= outSize) {
    Serial.println("[telemetry] payload melebihi kapasitas buffer");
    return 0;
  }
  return written;
}

void publish(const SensorReading& reading) {
  char payload[MQTT_BUFFER_SIZE];
  if (buildPayload(reading, payload, sizeof(payload)) == 0) return;

  if (MqttClient::isConnected() && MqttClient::publish("telemetry", payload)) {
    Serial.printf("[telemetry] terkirim: %s\n", payload);
  } else {
    pushToBuffer(payload);
    Serial.printf("[telemetry] offline, disimpan ke buffer (%d/%d)\n", count,
                  OFFLINE_BUFFER_SIZE);
  }
}

void flushBuffer() {
  if (count == 0) return;
  Serial.printf("[telemetry] mengirim %d payload tertunda\n", count);

  // Kirim dari yang terlama ke terbaru.
  const int start = (head - count + OFFLINE_BUFFER_SIZE) % OFFLINE_BUFFER_SIZE;
  int sent = 0;
  for (int i = 0; i < count; i++) {
    const int index = (start + i) % OFFLINE_BUFFER_SIZE;
    if (!MqttClient::publish("telemetry", buffer[index])) break;
    sent++;
  }

  count -= sent;
  if (count == 0) {
    head = 0;
    Serial.println("[telemetry] buffer kosong");
  }
}

void publishStatus(bool online) {
  JsonDocument doc;
  doc["status"] = online ? "online" : "offline";
  doc["deviceId"] = DEVICE_ID;
  doc["pondId"] = POND_ID;
  doc["ip"] = WifiManager::ipAddress();
  doc["rssi"] = WifiManager::rssi();
  doc["uptime"] = millis() / 1000;

  char payload[MQTT_BUFFER_SIZE];
  serializeJson(doc, payload, sizeof(payload));
  MqttClient::publish("status", payload, /*retain=*/true);
}

}  // namespace Telemetry

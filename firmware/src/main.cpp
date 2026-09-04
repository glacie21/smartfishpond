// ============================================================
//  Smart Fish Pond IoT — Node Sensor ESP32
//
//  Alur kerja:
//    1. Sambungkan WiFi lalu MQTT (keduanya reconnect otomatis).
//    2. Setiap SAMPLE_INTERVAL_MS  -> baca sensor, tampung sebagai
//       pembacaan terakhir.
//    3. Setiap PUBLISH_INTERVAL_MS -> kirim pembacaan terakhir sebagai
//       telemetri JSON. Bila offline, payload masuk buffer melingkar.
//
//  Loop dibuat non-blocking (tanpa delay panjang) agar PubSubClient
//  tetap sempat memproses keep-alive.
// ============================================================

#include <Arduino.h>

#include "config.h"
#include "mqtt_client.h"
#include "sensors.h"
#include "telemetry.h"
#include "wifi_manager.h"

namespace {

unsigned long lastSampleMs = 0;
unsigned long lastPublishMs = 0;
SensorReading latestReading{};
bool hasReading = false;

/** LED menyala tetap saat MQTT tersambung, berkedip saat belum. */
void updateStatusLed() {
  if (MqttClient::isConnected()) {
    digitalWrite(PIN_STATUS_LED, HIGH);
  } else {
    digitalWrite(PIN_STATUS_LED, (millis() / 500) % 2 == 0 ? HIGH : LOW);
  }
}

void logReading(const SensorReading& r) {
  Serial.printf(
      "[sensor] suhu=%.2f C | pH=%.2f | TDS=%.0f ppm | DO=%.2f mg/L | "
      "kekeruhan=%.1f NTU | level=%.1f cm\n",
      r.temperatureC, r.ph, r.tdsPpm, r.doMgL, r.turbidityNtu, r.waterLevelCm);
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== Smart Fish Pond IoT — node sensor ===");
  Serial.printf("Device : %s\nKolam  : %s\n", DEVICE_ID, POND_ID);

  pinMode(PIN_STATUS_LED, OUTPUT);

  Sensors::begin();
  WifiManager::begin();
  MqttClient::begin();
}

void loop() {
  WifiManager::loop();
  MqttClient::loop();
  updateStatusLed();

  const unsigned long now = millis();

  if (now - lastSampleMs >= SAMPLE_INTERVAL_MS) {
    lastSampleMs = now;
    latestReading = Sensors::read();
    hasReading = true;
    logReading(latestReading);
  }

  if (hasReading && now - lastPublishMs >= PUBLISH_INTERVAL_MS) {
    lastPublishMs = now;
    Telemetry::publish(latestReading);
  }
}

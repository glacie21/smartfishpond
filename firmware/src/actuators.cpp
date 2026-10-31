#include "actuators.h"

#include <ArduinoJson.h>

#include "config.h"
#include "mqtt_client.h"

namespace {

struct Actuator {
  const char* name;
  uint8_t pin;
  bool state;
  unsigned long onSinceMs;   // kapan dinyalakan dengan durasi
  unsigned long durationMs;  // 0 = menyala sampai dimatikan
};

Actuator actuators[] = {
    {"aerator", PIN_RELAY_AERATOR, AERATOR_ON_AT_BOOT, 0, 0},
    {"pump", PIN_RELAY_PUMP, PUMP_ON_AT_BOOT, 0, 0},
    {"feeder", PIN_RELAY_FEEDER, FEEDER_ON_AT_BOOT, 0, 0},
};

void writeRelay(const Actuator& a) {
  const bool level = RELAY_ACTIVE_LOW ? !a.state : a.state;
  digitalWrite(a.pin, level ? HIGH : LOW);
}

Actuator* find(const char* name) {
  for (auto& a : actuators) {
    if (strcmp(a.name, name) == 0) return &a;
  }
  return nullptr;
}

void apply(Actuator& a, bool state, unsigned long durationS) {
  a.state = state;
  a.onSinceMs = millis();
  a.durationMs = (state && durationS > 0) ? durationS * 1000UL : 0;
  writeRelay(a);
  Serial.printf("[aktuator] %s %s", a.name, state ? "ON" : "OFF");
  if (a.durationMs) Serial.printf(" selama %lu detik", durationS);
  Serial.println();
}

void sendAck(const char* id, bool ok, const char* error) {
  JsonDocument doc;
  doc["id"] = id;
  doc["ok"] = ok;
  if (error) {
    doc["error"] = error;
  } else {
    doc["error"] = nullptr;
  }

  char payload[160];
  serializeJson(doc, payload, sizeof(payload));
  MqttClient::publish("ack", payload);
}

}  // namespace

namespace Actuators {

void begin() {
  for (auto& a : actuators) {
    // Tulis level dulu sebelum OUTPUT agar relay tidak sempat berkedip saat boot.
    writeRelay(a);
    pinMode(a.pin, OUTPUT);
    writeRelay(a);
  }
}

void loop() {
  for (auto& a : actuators) {
    // Selisih unsigned tetap benar saat millis() melimpah (~49 hari).
    if (a.state && a.durationMs && millis() - a.onSinceMs >= a.durationMs) {
      apply(a, false, 0);
      publishState();
    }
  }
}

void handleCommand(const byte* payload, unsigned int length) {
  JsonDocument doc;
  const DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.printf("[aktuator] perintah bukan JSON valid: %s\n", err.c_str());
    return;  // tanpa id, tidak ada yang bisa dibalas; backend akan timeout
  }

  // Salin sebelum publish apa pun: buffer PubSubClient dipakai ulang saat publish.
  char id[40];
  char name[16];
  strlcpy(id, doc["id"] | "", sizeof(id));
  strlcpy(name, doc["actuator"] | "", sizeof(name));
  const bool state = doc["state"] | false;
  const unsigned long durationS = doc["durationS"] | 0UL;

  if (id[0] == '\0') {
    Serial.println("[aktuator] perintah tanpa id diabaikan");
    return;
  }

  Actuator* a = find(name);
  if (!a) {
    sendAck(id, false, "aktuator tidak terpasang");
    return;
  }
  if (durationS > ACTUATOR_MAX_DURATION_S) {
    sendAck(id, false, "durasi melebihi batas");
    return;
  }

  apply(*a, state, durationS);
  sendAck(id, true, nullptr);
  publishState();
}

void publishState() {
  JsonDocument doc;
  for (const auto& a : actuators) doc[a.name] = a.state;

  char payload[128];
  serializeJson(doc, payload, sizeof(payload));
  MqttClient::publish("actuators", payload, /*retain=*/true);
}

}  // namespace Actuators

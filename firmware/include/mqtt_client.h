// ============================================================
//  mqtt_client.h — publikasi telemetri ke broker MQTT.
// ============================================================
#pragma once

#include <Arduino.h>

namespace MqttClient {

/** Konfigurasi broker, client id, dan Last Will. */
void begin();

/** Menjaga koneksi + memproses paket masuk. Panggil tiap loop. */
void loop();

bool isConnected();

/** Publish payload ke sub-topik device (mis. "telemetry"). */
bool publish(const char* subTopic, const char* payload, bool retain = false);

}  // namespace MqttClient

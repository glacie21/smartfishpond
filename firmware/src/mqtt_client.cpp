#include "mqtt_client.h"

#include <PubSubClient.h>
#include <WiFi.h>

#include "actuators.h"
#include "config.h"
#include "telemetry.h"
#include "wifi_manager.h"

#if MQTT_USE_TLS
#include <WiFiClientSecure.h>
#endif

namespace {

#if MQTT_USE_TLS
WiFiClientSecure netClient;
#else
WiFiClient netClient;
#endif
PubSubClient client(netClient);
unsigned long lastAttemptMs = 0;

char statusTopic[96];
char commandTopic[96];

/** Menyusun topik lengkap: fishpond/<pondId>/<deviceId>/<sub>. */
void buildTopic(char* out, size_t size, const char* subTopic) {
  snprintf(out, size, "%s/%s/%s/%s", MQTT_TOPIC_BASE, POND_ID, DEVICE_ID,
           subTopic);
}

/** Callback pesan masuk: saat ini hanya perintah aktuator dari backend. */
void onMessage(char* topic, byte* payload, unsigned int length) {
  Serial.printf("[mqtt] pesan diterima pada %s (%u byte)\n", topic, length);
  if (strcmp(topic, commandTopic) == 0) {
    Actuators::handleCommand(payload, length);
  }
}

bool connect() {
  Serial.printf("[mqtt] menghubungkan ke %s:%d ...\n", MQTT_HOST, MQTT_PORT);

  // Last Will: broker menandai device offline bila koneksi putus mendadak.
  const char* willPayload = "{\"status\":\"offline\"}";
  bool ok;
  if (strlen(MQTT_USERNAME) > 0) {
    ok = client.connect(DEVICE_ID, MQTT_USERNAME, MQTT_PASSWORD, statusTopic,
                        MQTT_QOS, true, willPayload);
  } else {
    ok = client.connect(DEVICE_ID, nullptr, nullptr, statusTopic, MQTT_QOS,
                        true, willPayload);
  }

  if (ok) {
    Serial.println("[mqtt] terhubung");
    // Clean session: langganan hilang tiap putus, jadi subscribe ulang di sini.
    client.subscribe(commandTopic, MQTT_QOS);
    Telemetry::publishStatus(true);
    Actuators::publishState();
    Telemetry::flushBuffer();
  } else {
    const int rc = client.state();
    Serial.printf("[mqtt] gagal, rc=%d\n", rc);
    if (rc == MQTT_CONNECT_BAD_CREDENTIALS || rc == MQTT_CONNECT_UNAUTHORIZED) {
      Serial.println(
          "[mqtt] ditolak broker: periksa MQTT_USERNAME (= DEVICE_ID) dan "
          "MQTT_PASSWORD di secrets.h vs docker/mosquitto/credentials");
    }
  }
  return ok;
}

}  // namespace

namespace MqttClient {

void begin() {
  buildTopic(statusTopic, sizeof(statusTopic), "status");
  buildTopic(commandTopic, sizeof(commandTopic), "command");
#if MQTT_USE_TLS
  // Verifikasi sertifikat broker terhadap CA; tanpa ini TLS rentan MITM.
  netClient.setCACert(MQTT_CA_CERT);
#endif
  client.setServer(MQTT_HOST, MQTT_PORT);
  client.setCallback(onMessage);
  client.setBufferSize(MQTT_BUFFER_SIZE);
  client.setKeepAlive(60);
}

void loop() {
  if (!WifiManager::isConnected()) return;

  if (!client.connected()) {
    if (millis() - lastAttemptMs >= MQTT_RETRY_INTERVAL_MS) {
      lastAttemptMs = millis();
      connect();
    }
    return;
  }
  client.loop();
}

bool isConnected() { return client.connected(); }

bool publish(const char* subTopic, const char* payload, bool retain) {
  if (!client.connected()) return false;

  char topic[96];
  buildTopic(topic, sizeof(topic), subTopic);
  const bool ok = client.publish(topic, payload, retain);
  if (!ok) Serial.printf("[mqtt] gagal publish ke %s\n", topic);
  return ok;
}

}  // namespace MqttClient

#include "wifi_manager.h"

#include <WiFi.h>

#include "config.h"

namespace {
unsigned long lastAttemptMs = 0;
bool wasConnected = false;
}  // namespace

namespace WifiManager {

void begin() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);  // hindari latensi tinggi pada modem sleep
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.printf("[wifi] menghubungkan ke \"%s\"", WIFI_SSID);
  const unsigned long startMs = millis();
  while (WiFi.status() != WL_CONNECTED &&
         millis() - startMs < WIFI_CONNECT_TIMEOUT_MS) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    wasConnected = true;
    Serial.printf("[wifi] terhubung, IP %s (RSSI %d dBm)\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("[wifi] gagal terhubung, akan dicoba ulang di loop()");
  }
  lastAttemptMs = millis();
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wasConnected) {
      wasConnected = true;
      Serial.printf("[wifi] tersambung kembali, IP %s\n",
                    WiFi.localIP().toString().c_str());
    }
    return;
  }

  if (wasConnected) {
    wasConnected = false;
    Serial.println("[wifi] koneksi terputus");
  }

  // Reconnect non-blocking: cukup satu percobaan per interval.
  if (millis() - lastAttemptMs >= WIFI_RETRY_INTERVAL_MS) {
    lastAttemptMs = millis();
    Serial.println("[wifi] mencoba menyambung ulang...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}

bool isConnected() { return WiFi.status() == WL_CONNECTED; }

int rssi() { return isConnected() ? WiFi.RSSI() : 0; }

String ipAddress() {
  return isConnected() ? WiFi.localIP().toString() : String("0.0.0.0");
}

}  // namespace WifiManager

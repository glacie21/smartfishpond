#include "ota.h"

#include <ArduinoOTA.h>

#include "config.h"
#include "wifi_manager.h"

namespace {

bool started = false;
bool warnedDisabled = false;

void start() {
  ArduinoOTA.setHostname(DEVICE_ID);  // tampil sebagai <DEVICE_ID>.local
  ArduinoOTA.setPassword(OTA_PASSWORD);

  ArduinoOTA.onStart([]() {
    Serial.println("[ota] update dimulai — relay mempertahankan kondisinya");
  });
  ArduinoOTA.onEnd([]() { Serial.println("\n[ota] selesai, restart..."); });
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("[ota] %u%%\r", progress * 100 / total);
  });
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("[ota] gagal (kode %u)%s\n", error,
                  error == OTA_AUTH_ERROR ? ": password OTA salah" : "");
  });

  ArduinoOTA.begin();
  started = true;
  Serial.printf("[ota] siap di %s.local (%s)\n", DEVICE_ID,
                WifiManager::ipAddress().c_str());
}

}  // namespace

namespace Ota {

void loop() {
  if (strlen(OTA_PASSWORD) == 0) {
    if (!warnedDisabled) {
      Serial.println("[ota] nonaktif: OTA_PASSWORD di secrets.h kosong");
      warnedDisabled = true;
    }
    return;
  }

  // mDNS & listener butuh WiFi aktif, jadi dimulai saat pertama tersambung.
  if (!started) {
    if (WifiManager::isConnected()) start();
    return;
  }
  ArduinoOTA.handle();
}

}  // namespace Ota

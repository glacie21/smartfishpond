// ============================================================
//  wifi_manager.h — koneksi WiFi dengan reconnect non-blocking.
// ============================================================
#pragma once

#include <Arduino.h>

namespace WifiManager {

/** Mulai koneksi ke SSID pada secrets.h. */
void begin();

/** Dipanggil tiap loop; menangani reconnect otomatis. */
void loop();

bool isConnected();

/** Kekuatan sinyal dalam dBm (0 bila tidak terhubung). */
int rssi();

String ipAddress();

}  // namespace WifiManager

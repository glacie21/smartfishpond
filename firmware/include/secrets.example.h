// ============================================================
//  secrets.h — kredensial perangkat.
//  SALIN file ini menjadi `secrets.h` lalu isi nilainya.
//  File `secrets.h` sengaja di-ignore oleh git.
// ============================================================
#pragma once

// --- WiFi ---
#define WIFI_SSID       "NamaWiFiAnda"
#define WIFI_PASSWORD   "PasswordWiFiAnda"

// --- MQTT Broker ---
#define MQTT_HOST       "192.168.1.10"   // IP / hostname broker
#define MQTT_PORT       1883
#define MQTT_USERNAME   ""               // kosongkan jika broker anonim
#define MQTT_PASSWORD   ""

// --- Identitas perangkat ---
#define DEVICE_ID       "esp32-node-01"
#define POND_ID         "pond-01"

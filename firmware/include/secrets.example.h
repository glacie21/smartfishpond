// ============================================================
//  secrets.h — kredensial perangkat.
//  SALIN file ini menjadi `secrets.h` lalu isi nilainya.
//  File `secrets.h` sengaja di-ignore oleh git.
// ============================================================
#pragma once

// --- WiFi ---
#define WIFI_SSID       "NamaWiFiAnda"
#define WIFI_PASSWORD   "PasswordWiFiAnda"

// --- Identitas perangkat ---
#define DEVICE_ID       "esp32-node-01"
#define POND_ID         "pond-01"

// --- MQTT Broker ---
#define MQTT_HOST       "192.168.1.10"   // IP / hostname broker
#define MQTT_PORT       1883             // 8883 bila MQTT_USE_TLS = 1

// Broker menolak koneksi anonim. Username WAJIB sama dengan DEVICE_ID
// (ACL broker memakainya), password sesuai baris device ini di
// docker/mosquitto/credentials.
#define MQTT_USERNAME   DEVICE_ID
#define MQTT_PASSWORD   "ganti-dengan-password-acak-device-01"

// --- TLS (opsional, disarankan bila broker di luar jaringan lokal) ---
// 1 = koneksi terenkripsi ke listener 8883. MQTT_HOST harus sama dengan
// nama/IP pada sertifikat server.
#define MQTT_USE_TLS    0
// Isi dengan sertifikat CA (ca.crt) yang menandatangani sertifikat broker.
#define MQTT_CA_CERT \
  "-----BEGIN CERTIFICATE-----\n" \
  "...isi ca.crt...\n" \
  "-----END CERTIFICATE-----\n"

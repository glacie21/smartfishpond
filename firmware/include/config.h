// ============================================================
//  config.h — konfigurasi pin, interval, dan kalibrasi sensor.
// ============================================================
#pragma once

#include "secrets.h"

// secrets.h lama (sebelum dukungan TLS) tetap bisa dikompilasi.
#ifndef MQTT_USE_TLS
#define MQTT_USE_TLS 0
#endif

// secrets.h lama (sebelum dukungan OTA): OTA nonaktif.
#ifndef OTA_PASSWORD
#define OTA_PASSWORD ""
#endif

// ------------------------------------------------------------
//  Pin map (ESP32 DevKit v1)
// ------------------------------------------------------------
#define PIN_ONEWIRE_TEMP    4    // DS18B20   (digital, butuh pull-up 4k7)
#define PIN_PH              34   // pH meter  (ADC1_CH6, input only)
#define PIN_TDS             35   // TDS meter (ADC1_CH7, input only)
#define PIN_DO              32   // Dissolved oxygen (ADC1_CH4)
#define PIN_TURBIDITY       33   // Turbidity (ADC1_CH5)
#define PIN_ULTRASONIC_TRIG 5    // HC-SR04 / JSN-SR04T trigger
#define PIN_ULTRASONIC_ECHO 18   // HC-SR04 / JSN-SR04T echo
#define PIN_STATUS_LED      2    // LED onboard sebagai indikator koneksi

// Modul relay untuk aktuator. Relay yang tidak terpasang aman dibiarkan.
#define PIN_RELAY_AERATOR   25   // aerator / blower oksigen
#define PIN_RELAY_PUMP      26   // pompa air (sirkulasi / pengisian)
#define PIN_RELAY_FEEDER    27   // motor pemberi pakan otomatis

// ------------------------------------------------------------
//  Aktuator
// ------------------------------------------------------------
// Kebanyakan modul relay 5V aktif LOW (IN = LOW -> relay menyala).
#define RELAY_ACTIVE_LOW    1
// Kondisi saat boot / setelah listrik padam. Aerator default MENYALA:
// mati lama di malam hari bisa membuat ikan kekurangan oksigen.
#define AERATOR_ON_AT_BOOT  1
#define PUMP_ON_AT_BOOT     0
#define FEEDER_ON_AT_BOOT   0
// Batas atas durasi auto-off, sama dengan backend (24 jam).
#define ACTUATOR_MAX_DURATION_S 86400UL

// ------------------------------------------------------------
//  Interval (milidetik)
// ------------------------------------------------------------
#define SAMPLE_INTERVAL_MS    5000UL    // periode baca sensor
#define PUBLISH_INTERVAL_MS   30000UL   // periode kirim telemetri
#define WIFI_RETRY_INTERVAL_MS 10000UL
#define MQTT_RETRY_INTERVAL_MS 5000UL
#define WIFI_CONNECT_TIMEOUT_MS 20000UL

// ------------------------------------------------------------
//  ADC
// ------------------------------------------------------------
#define ADC_RESOLUTION      4095.0f   // ESP32 ADC 12-bit
#define ADC_VREF            3.3f      // volt
#define ADC_SAMPLE_COUNT    20        // jumlah sampel untuk rata-rata bergerak

// ------------------------------------------------------------
//  Kalibrasi sensor
//  Nilai di bawah adalah titik awal — WAJIB dikalibrasi ulang
//  dengan larutan buffer / larutan standar. Lihat docs/hardware.md.
// ------------------------------------------------------------

// pH: hubungan linier tegangan -> pH, pH = PH_SLOPE * volt + PH_OFFSET
#define PH_SLOPE            -5.70f
#define PH_OFFSET           21.34f

// TDS: koefisien kompensasi suhu terhadap 25 degC
#define TDS_TEMP_COEF       0.02f
#define TDS_K_VALUE         1.0f     // konstanta probe

// Dissolved oxygen: kalibrasi dua titik (mg/L)
#define DO_CAL_VOLT_MV      1600.0f  // tegangan saat saturasi pada DO_CAL_TEMP
#define DO_CAL_TEMP_C       25.0f

// Turbidity: tegangan pada air jernih (volt)
#define TURBIDITY_CLEAR_V   4.10f

// Level air: jarak sensor ke dasar kolam (cm)
#define POND_DEPTH_CM       120.0f
#define ULTRASONIC_TIMEOUT_US 30000UL

// ------------------------------------------------------------
//  MQTT topics — lihat docs/mqtt-topics.md
// ------------------------------------------------------------
#define MQTT_TOPIC_BASE     "fishpond"
#define MQTT_QOS            1
#define MQTT_BUFFER_SIZE    512

// ------------------------------------------------------------
//  Buffer offline
// ------------------------------------------------------------
#define OFFLINE_BUFFER_SIZE 20   // jumlah payload yang ditahan saat offline

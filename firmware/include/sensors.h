// ============================================================
//  sensors.h — pembacaan dan konversi seluruh sensor kolam.
// ============================================================
#pragma once

#include <Arduino.h>

/** Satu set pembacaan kualitas air. */
struct SensorReading {
  float temperatureC;   // suhu air (degC)
  float ph;             // derajat keasaman (0-14)
  float tdsPpm;         // total dissolved solids (ppm)
  float doMgL;          // dissolved oxygen (mg/L)
  float turbidityNtu;   // kekeruhan (NTU)
  float waterLevelCm;   // tinggi muka air dari dasar (cm)
  bool  valid;          // false jika ada sensor gagal dibaca
};

namespace Sensors {

/** Inisialisasi bus OneWire, pin ADC, dan pin ultrasonik. */
void begin();

/** Membaca semua sensor sekali jalan. */
SensorReading read();

/** Rata-rata bergerak beberapa pembacaan agar noise ADC berkurang. */
float readAnalogVolt(uint8_t pin);

}  // namespace Sensors

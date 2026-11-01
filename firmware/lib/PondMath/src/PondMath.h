// ============================================================
//  PondMath — konversi sensor & logika waktu yang murni matematis.
//
//  Sengaja tanpa Arduino.h dan tanpa config.h: semua konstanta kalibrasi
//  masuk lewat parameter, sehingga bisa diuji di komputer biasa:
//      pio test -e native
// ============================================================
#pragma once

#include <stdint.h>

namespace PondMath {

/** Tegangan probe pH -> pH (kalibrasi linier: pH = slope * volt + offset). */
float voltToPh(float volt, float slope, float offset);

/**
 * Tegangan probe TDS -> ppm, dikompensasi ke 25 degC.
 * Polinomial dari datasheet Gravity Analog TDS Sensor. Tidak pernah negatif.
 */
float voltToTds(float volt, float temperatureC, float tempCoef, float kValue);

/**
 * Tegangan probe DO -> mg/L (kalibrasi satu titik ala DFRobot SEN0237).
 *
 *   V_sat(T) = calVoltMv + 35 * (T - calTempC)
 *   DO       = V_terukur / V_sat(T) * saturasi(T)
 *
 * Suhu di luar 0..40 degC memakai saturasi di ujung tabel.
 */
float voltToDissolvedOxygen(float volt, float temperatureC, float calVoltMv, float calTempC);

/** Saturasi oksigen terlarut (mg/L) air tawar pada 1 atm, suhu dibulatkan & dibatasi 0..40. */
float oxygenSaturationMgL(float temperatureC);

/** Tegangan sensor kekeruhan -> NTU (kurva kuadratik SEN0189). Air jernih = 0. */
float voltToTurbidity(float volt, float clearVolt);

/**
 * Durasi pulsa echo ultrasonik (mikrodetik) -> jarak (cm).
 * Mengembalikan NAN bila durasi 0 (timeout: tidak ada echo).
 */
float echoToDistanceCm(unsigned long durationUs);

/** Tinggi muka air dari dasar kolam; tidak pernah negatif. NAN tetap NAN. */
float waterLevelCm(float distanceCm, float pondDepthCm);

/**
 * true bila sudah lewat `durationMs` sejak `sinceMs`.
 * Aritmetika unsigned tetap benar saat millis() melimpah (~49,7 hari).
 */
bool elapsedAtLeast(uint32_t nowMs, uint32_t sinceMs, uint32_t durationMs);

}  // namespace PondMath

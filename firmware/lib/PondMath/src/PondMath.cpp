#include "PondMath.h"

#include <math.h>

namespace PondMath {

float voltToPh(float volt, float slope, float offset) {
  return slope * volt + offset;
}

float voltToTds(float volt, float temperatureC, float tempCoef, float kValue) {
  const float compensation = 1.0f + tempCoef * (temperatureC - 25.0f);
  const float v = volt / compensation;
  const float ppm = (133.42f * v * v * v - 255.86f * v * v + 857.39f * v) * 0.5f * kValue;
  return ppm < 0.0f ? 0.0f : ppm;
}

float oxygenSaturationMgL(float temperatureC) {
  // Saturasi oksigen terlarut (ug/L) pada 1 atm, indeks = suhu dalam degC.
  static const uint16_t kSaturationTable[41] = {
      14460, 14220, 13820, 13440, 13090, 12740, 12420, 12110, 11810, 11530,
      11260, 11010, 10770, 10530, 10300, 10080, 9860,  9660,  9460,  9270,
      9080,  8900,  8730,  8570,  8410,  8250,  8110,  7960,  7820,  7690,
      7560,  7430,  7300,  7180,  7070,  6950,  6840,  6730,  6630,  6530,
      6410};

  int index = (int)roundf(temperatureC);
  if (index < 0) index = 0;
  if (index > 40) index = 40;
  return kSaturationTable[index] / 1000.0f;
}

float voltToDissolvedOxygen(float volt, float temperatureC, float calVoltMv, float calTempC) {
  const float saturationVoltMv = calVoltMv + 35.0f * (temperatureC - calTempC);
  if (saturationVoltMv <= 0.0f) return 0.0f;

  const float measuredMv = volt * 1000.0f;
  const float mgPerL = measuredMv / saturationVoltMv * oxygenSaturationMgL(temperatureC);
  return mgPerL < 0.0f ? 0.0f : mgPerL;
}

float voltToTurbidity(float volt, float clearVolt) {
  if (volt >= clearVolt) return 0.0f;
  const float ntu = -1120.4f * volt * volt + 5742.3f * volt - 4353.8f;
  return ntu < 0.0f ? 0.0f : ntu;
}

float echoToDistanceCm(unsigned long durationUs) {
  if (durationUs == 0) return NAN;
  // Kecepatan suara 343 m/s -> 0.0343 cm/us, dibagi 2 (pulang-pergi).
  return (durationUs * 0.0343f) / 2.0f;
}

float waterLevelCm(float distanceCm, float pondDepthCm) {
  if (isnan(distanceCm)) return NAN;
  const float level = pondDepthCm - distanceCm;
  return level < 0.0f ? 0.0f : level;
}

bool elapsedAtLeast(uint32_t nowMs, uint32_t sinceMs, uint32_t durationMs) {
  return (uint32_t)(nowMs - sinceMs) >= durationMs;
}

}  // namespace PondMath

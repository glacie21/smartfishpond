#include "sensors.h"

#include <DallasTemperature.h>
#include <OneWire.h>

#include "config.h"

namespace {

OneWire oneWire(PIN_ONEWIRE_TEMP);
DallasTemperature dallas(&oneWire);

/** Konversi tegangan probe pH menjadi nilai pH (kalibrasi linier dua titik). */
float voltToPh(float volt) {
  return PH_SLOPE * volt + PH_OFFSET;
}

/**
 * Konversi tegangan probe TDS menjadi ppm, dikompensasi terhadap suhu.
 * Rumus polinomial mengikuti datasheet Gravity Analog TDS Sensor.
 */
float voltToTds(float volt, float temperatureC) {
  const float compensation = 1.0f + TDS_TEMP_COEF * (temperatureC - 25.0f);
  const float compensatedVolt = volt / compensation;
  const float ppm = (133.42f * compensatedVolt * compensatedVolt * compensatedVolt -
                     255.86f * compensatedVolt * compensatedVolt +
                     857.39f * compensatedVolt) *
                    0.5f * TDS_K_VALUE;
  return ppm < 0.0f ? 0.0f : ppm;
}

/**
 * Konversi tegangan probe DO menjadi mg/L.
 *
 * Memakai kalibrasi satu titik ala DFRobot SEN0237: tegangan saat larutan
 * jenuh oksigen bergeser ~35 mV per degC dari titik kalibrasi.
 *
 *   V_sat(T) = DO_CAL_VOLT_MV + 35 * (T - DO_CAL_TEMP_C)
 *   DO(ug/L) = V_terukur / V_sat(T) * saturasi(T)
 */
float voltToDissolvedOxygen(float volt, float temperatureC) {
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

  const float saturationVoltMv =
      DO_CAL_VOLT_MV + 35.0f * (temperatureC - DO_CAL_TEMP_C);
  if (saturationVoltMv <= 0.0f) return 0.0f;

  const float measuredMv = volt * 1000.0f;
  const float ugPerL = measuredMv / saturationVoltMv * kSaturationTable[index];
  const float mgPerL = ugPerL / 1000.0f;
  return mgPerL < 0.0f ? 0.0f : mgPerL;
}

/** Konversi tegangan sensor kekeruhan menjadi NTU (kurva kuadratik SEN0189). */
float voltToTurbidity(float volt) {
  if (volt >= TURBIDITY_CLEAR_V) return 0.0f;
  const float ntu = -1120.4f * volt * volt + 5742.3f * volt - 4353.8f;
  return ntu < 0.0f ? 0.0f : ntu;
}

/** Jarak permukaan air dari sensor (cm) memakai HC-SR04 / JSN-SR04T. */
float readDistanceCm() {
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_ULTRASONIC_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);

  const unsigned long duration =
      pulseIn(PIN_ULTRASONIC_ECHO, HIGH, ULTRASONIC_TIMEOUT_US);
  if (duration == 0) return NAN;  // timeout: tidak ada echo

  // Kecepatan suara 343 m/s -> 0.0343 cm/us, dibagi 2 (pulang-pergi).
  return (duration * 0.0343f) / 2.0f;
}

}  // namespace

namespace Sensors {

void begin() {
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_PH, ADC_11db);
  analogSetPinAttenuation(PIN_TDS, ADC_11db);
  analogSetPinAttenuation(PIN_DO, ADC_11db);
  analogSetPinAttenuation(PIN_TURBIDITY, ADC_11db);

  pinMode(PIN_ULTRASONIC_TRIG, OUTPUT);
  pinMode(PIN_ULTRASONIC_ECHO, INPUT);

  dallas.begin();
  dallas.setResolution(12);

  Serial.printf("[sensors] siap, %d sensor suhu terdeteksi\n",
                dallas.getDeviceCount());
}

float readAnalogVolt(uint8_t pin) {
  uint32_t total = 0;
  for (int i = 0; i < ADC_SAMPLE_COUNT; i++) {
    total += analogRead(pin);
    delayMicroseconds(200);
  }
  const float average = (float)total / ADC_SAMPLE_COUNT;
  return (average / ADC_RESOLUTION) * ADC_VREF;
}

SensorReading read() {
  SensorReading r{};
  r.valid = true;

  dallas.requestTemperatures();
  r.temperatureC = dallas.getTempCByIndex(0);
  if (r.temperatureC == DEVICE_DISCONNECTED_C) {
    Serial.println("[sensors] DS18B20 tidak merespons");
    r.temperatureC = NAN;
    r.valid = false;
  }

  const float tempForCompensation = isnan(r.temperatureC) ? 25.0f : r.temperatureC;

  r.ph = voltToPh(readAnalogVolt(PIN_PH));
  r.tdsPpm = voltToTds(readAnalogVolt(PIN_TDS), tempForCompensation);
  r.doMgL = voltToDissolvedOxygen(readAnalogVolt(PIN_DO), tempForCompensation);
  r.turbidityNtu = voltToTurbidity(readAnalogVolt(PIN_TURBIDITY));

  const float distance = readDistanceCm();
  if (isnan(distance)) {
    Serial.println("[sensors] ultrasonik timeout");
    r.waterLevelCm = NAN;
    r.valid = false;
  } else {
    r.waterLevelCm = POND_DEPTH_CM - distance;
    if (r.waterLevelCm < 0.0f) r.waterLevelCm = 0.0f;
  }

  return r;
}

}  // namespace Sensors

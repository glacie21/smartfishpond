#include "sensors.h"

#include <DallasTemperature.h>
#include <OneWire.h>
#include <PondMath.h>

#include "config.h"

namespace {

OneWire oneWire(PIN_ONEWIRE_TEMP);
DallasTemperature dallas(&oneWire);

/** Jarak permukaan air dari sensor (cm) memakai HC-SR04 / JSN-SR04T. */
float readDistanceCm() {
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_ULTRASONIC_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_ULTRASONIC_TRIG, LOW);

  // Timeout (tidak ada echo) -> pulseIn 0 -> NAN.
  return PondMath::echoToDistanceCm(
      pulseIn(PIN_ULTRASONIC_ECHO, HIGH, ULTRASONIC_TIMEOUT_US));
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

  // Rumus konversi ada di lib/PondMath (diuji di host: pio test -e native).
  r.ph = PondMath::voltToPh(readAnalogVolt(PIN_PH), PH_SLOPE, PH_OFFSET);
  r.tdsPpm = PondMath::voltToTds(readAnalogVolt(PIN_TDS), tempForCompensation,
                                 TDS_TEMP_COEF, TDS_K_VALUE);
  r.doMgL = PondMath::voltToDissolvedOxygen(readAnalogVolt(PIN_DO), tempForCompensation,
                                            DO_CAL_VOLT_MV, DO_CAL_TEMP_C);
  r.turbidityNtu =
      PondMath::voltToTurbidity(readAnalogVolt(PIN_TURBIDITY), TURBIDITY_CLEAR_V);

  const float distance = readDistanceCm();
  if (isnan(distance)) {
    Serial.println("[sensors] ultrasonik timeout");
    r.waterLevelCm = NAN;
    r.valid = false;
  } else {
    r.waterLevelCm = PondMath::waterLevelCm(distance, POND_DEPTH_CM);
  }

  return r;
}

}  // namespace Sensors

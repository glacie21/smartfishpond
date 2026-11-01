// ============================================================
//  Unit test PondMath — berjalan di komputer biasa:
//      pio test -e native
//  Nilai acuan dihitung dari rumus datasheet masing-masing sensor.
// ============================================================
#include <math.h>
#include <unity.h>

#include <PondMath.h>

using namespace PondMath;

// Kalibrasi bawaan di config.h, ditulis ulang agar test tidak butuh secrets.h.
static const float PH_SLOPE = -5.70f;
static const float PH_OFFSET = 21.34f;
static const float TDS_TEMP_COEF = 0.02f;
static const float TDS_K_VALUE = 1.0f;
static const float DO_CAL_VOLT_MV = 1600.0f;
static const float DO_CAL_TEMP_C = 25.0f;
static const float TURBIDITY_CLEAR_V = 4.10f;

void setUp() {}
void tearDown() {}

// ---------- pH ----------

void test_ph_linear_calibration() {
  // 2,5 V adalah titik netral modul PH-4502C: -5,70 * 2,5 + 21,34 = 7,09
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 7.09f, voltToPh(2.5f, PH_SLOPE, PH_OFFSET));
  // Tegangan lebih tinggi -> lebih asam (slope negatif).
  TEST_ASSERT_TRUE(voltToPh(3.0f, PH_SLOPE, PH_OFFSET) < voltToPh(2.0f, PH_SLOPE, PH_OFFSET));
}

// ---------- TDS ----------

void test_tds_at_reference_temperature() {
  // 1,0 V pada 25 degC: (133,42 - 255,86 + 857,39) * 0,5 = 367,475 ppm
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 367.475f, voltToTds(1.0f, 25.0f, TDS_TEMP_COEF, TDS_K_VALUE));
}

void test_tds_temperature_compensation_lowers_ppm_when_warm() {
  const float at25 = voltToTds(1.0f, 25.0f, TDS_TEMP_COEF, TDS_K_VALUE);
  const float at30 = voltToTds(1.0f, 30.0f, TDS_TEMP_COEF, TDS_K_VALUE);
  // Air hangat lebih konduktif; setelah kompensasi, ppm-nya harus lebih kecil.
  TEST_ASSERT_TRUE(at30 < at25);
}

void test_tds_never_negative() {
  TEST_ASSERT_EQUAL_FLOAT(0.0f, voltToTds(0.0f, 25.0f, TDS_TEMP_COEF, TDS_K_VALUE));
  TEST_ASSERT_EQUAL_FLOAT(0.0f, voltToTds(-0.5f, 25.0f, TDS_TEMP_COEF, TDS_K_VALUE));
}

// ---------- Oksigen terlarut ----------

void test_do_saturation_table_bounds() {
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 8.25f, oxygenSaturationMgL(25.0f));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 14.46f, oxygenSaturationMgL(-3.0f));  // dibatasi ke 0 degC
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 6.41f, oxygenSaturationMgL(55.0f));   // dibatasi ke 40 degC
}

void test_do_at_calibration_point_equals_saturation() {
  // Tegangan = tegangan kalibrasi pada suhu kalibrasi -> tepat jenuh (8,25 mg/L @25 degC).
  const float mgL = voltToDissolvedOxygen(DO_CAL_VOLT_MV / 1000.0f, 25.0f, DO_CAL_VOLT_MV, DO_CAL_TEMP_C);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 8.25f, mgL);
}

void test_do_half_voltage_is_half_saturation() {
  const float mgL = voltToDissolvedOxygen(0.8f, 25.0f, DO_CAL_VOLT_MV, DO_CAL_TEMP_C);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 4.125f, mgL);
}

void test_do_invalid_saturation_voltage_returns_zero() {
  // V_sat(T) <= 0 (suhu sangat rendah dengan kalibrasi kecil) tidak boleh membagi nol.
  TEST_ASSERT_EQUAL_FLOAT(0.0f, voltToDissolvedOxygen(1.0f, 0.0f, 100.0f, 25.0f));
}

// ---------- Kekeruhan ----------

void test_turbidity_clear_water_is_zero() {
  TEST_ASSERT_EQUAL_FLOAT(0.0f, voltToTurbidity(4.2f, TURBIDITY_CLEAR_V));
  TEST_ASSERT_EQUAL_FLOAT(0.0f, voltToTurbidity(TURBIDITY_CLEAR_V, TURBIDITY_CLEAR_V));
}

void test_turbidity_curve() {
  // 3,0 V: -1120,4*9 + 5742,3*3 - 4353,8 = 2789,5 NTU
  TEST_ASSERT_FLOAT_WITHIN(0.5f, 2789.5f, voltToTurbidity(3.0f, TURBIDITY_CLEAR_V));
  // Tegangan lebih rendah -> air lebih keruh.
  TEST_ASSERT_TRUE(voltToTurbidity(2.8f, TURBIDITY_CLEAR_V) > voltToTurbidity(3.5f, TURBIDITY_CLEAR_V));
}

void test_turbidity_never_negative() {
  TEST_ASSERT_EQUAL_FLOAT(0.0f, voltToTurbidity(0.5f, TURBIDITY_CLEAR_V));
}

// ---------- Level air ----------

void test_echo_timeout_is_nan() {
  TEST_ASSERT_TRUE(isnan(echoToDistanceCm(0)));
  TEST_ASSERT_TRUE(isnan(waterLevelCm(echoToDistanceCm(0), 120.0f)));
}

void test_echo_to_distance() {
  // 1166 us * 0,0343 / 2 = 19,9969 cm
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 19.9969f, echoToDistanceCm(1166));
}

void test_water_level_from_distance() {
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 100.0f, waterLevelCm(20.0f, 120.0f));
  // Sensor membaca lebih jauh dari kedalaman kolam (pantulan liar) -> 0, bukan negatif.
  TEST_ASSERT_EQUAL_FLOAT(0.0f, waterLevelCm(150.0f, 120.0f));
}

// ---------- Timer auto-off aktuator ----------

void test_elapsed_basic() {
  TEST_ASSERT_FALSE(elapsedAtLeast(1500, 1000, 1000));
  TEST_ASSERT_TRUE(elapsedAtLeast(2000, 1000, 1000));
  TEST_ASSERT_TRUE(elapsedAtLeast(5000, 1000, 1000));
}

void test_elapsed_survives_millis_rollover() {
  // Dinyalakan 500 ms sebelum millis() melimpah ke 0, durasi 1 detik.
  const uint32_t since = 0xFFFFFFFFu - 499u;
  TEST_ASSERT_FALSE(elapsedAtLeast(200u, since, 1000u));  // baru 700 ms
  TEST_ASSERT_TRUE(elapsedAtLeast(500u, since, 1000u));   // tepat 1000 ms
}

int runAllTests() {
  UNITY_BEGIN();
  RUN_TEST(test_ph_linear_calibration);
  RUN_TEST(test_tds_at_reference_temperature);
  RUN_TEST(test_tds_temperature_compensation_lowers_ppm_when_warm);
  RUN_TEST(test_tds_never_negative);
  RUN_TEST(test_do_saturation_table_bounds);
  RUN_TEST(test_do_at_calibration_point_equals_saturation);
  RUN_TEST(test_do_half_voltage_is_half_saturation);
  RUN_TEST(test_do_invalid_saturation_voltage_returns_zero);
  RUN_TEST(test_turbidity_clear_water_is_zero);
  RUN_TEST(test_turbidity_curve);
  RUN_TEST(test_turbidity_never_negative);
  RUN_TEST(test_echo_timeout_is_nan);
  RUN_TEST(test_echo_to_distance);
  RUN_TEST(test_water_level_from_distance);
  RUN_TEST(test_elapsed_basic);
  RUN_TEST(test_elapsed_survives_millis_rollover);
  return UNITY_END();
}

#ifdef ARDUINO
// Di board: pio test -e esp32dev
#include <Arduino.h>
void setup() {
  delay(2000);  // beri waktu monitor serial tersambung
  runAllTests();
}
void loop() {}
#else
int main() { return runAllTests(); }
#endif

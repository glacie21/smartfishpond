// ============================================================
//  telemetry.h — serialisasi payload + buffer saat offline.
// ============================================================
#pragma once

#include "sensors.h"

namespace Telemetry {

/**
 * Menyusun payload JSON dari sebuah pembacaan.
 * @param out     buffer tujuan
 * @param outSize kapasitas buffer
 * @return jumlah byte yang ditulis (0 bila gagal)
 */
size_t buildPayload(const SensorReading& reading, char* out, size_t outSize);

/**
 * Kirim pembacaan. Bila MQTT sedang terputus, payload disimpan
 * ke buffer melingkar dan dikirim ulang saat koneksi pulih.
 */
void publish(const SensorReading& reading);

/** Kirim ulang isi buffer offline (dipanggil setelah reconnect). */
void flushBuffer();

/** Publish status perangkat (online/offline, rssi, uptime) — retained. */
void publishStatus(bool online);

}  // namespace Telemetry

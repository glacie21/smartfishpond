// ============================================================
//  actuators.h — relay aerator, pompa, dan feeder yang
//  dikendalikan lewat perintah MQTT dari backend.
// ============================================================
#pragma once

#include <Arduino.h>

namespace Actuators {

/** Mengatur pin relay dan kondisi awal (lihat *_ON_AT_BOOT di config.h). */
void begin();

/** Mematikan aktuator yang durasi auto-off-nya sudah habis. Panggil tiap loop. */
void loop();

/**
 * Menjalankan payload JSON dari topik `.../command`:
 *   {"id":"<uuid>","actuator":"aerator","state":true,"durationS":600}
 * lalu membalas ke `.../ack` dan menerbitkan status terbaru.
 */
void handleCommand(const byte* payload, unsigned int length);

/** Menerbitkan status semua relay ke `.../actuators` (retained). */
void publishState();

}  // namespace Actuators

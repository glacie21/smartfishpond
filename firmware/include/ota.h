// ============================================================
//  ota.h — update firmware lewat WiFi (ArduinoOTA, jaringan lokal).
//
//  Aktif hanya bila OTA_PASSWORD di secrets.h diisi; tanpa password,
//  siapa pun di jaringan yang sama bisa menimpa firmware.
//  Upload: pio run -e esp32dev-ota -t upload --upload-port <ip-device>
// ============================================================
#pragma once

namespace Ota {

/** Mulai listener OTA begitu WiFi tersambung. Panggil tiap loop. */
void loop();

}  // namespace Ota

import { z } from 'zod';

/** Nilai metrik: angka, atau null bila sensornya gagal dibaca. */
const metric = z.number().finite().nullable().optional();

/**
 * Bentuk payload yang dikirim firmware ke topik `.../telemetry`.
 * Lihat docs/mqtt-topics.md.
 */
export const telemetryPayloadSchema = z.object({
  deviceId: z.string().min(1).max(64),
  pondId: z.string().min(1).max(64),
  // Device tanpa RTC tidak mengirim timestamp; server memakai waktu terima.
  timestamp: z.string().datetime().optional(),
  uptime: z.number().int().nonnegative().optional(),
  rssi: z.number().int().optional(),
  metrics: z.object({
    temperature: metric,
    ph: metric,
    tds: metric,
    dissolvedOxygen: metric,
    turbidity: metric,
    waterLevel: metric,
  }),
});

/** Payload topik `.../status` (retained, termasuk Last Will). */
export const statusPayloadSchema = z.object({
  deviceId: z.string().min(1).max(64).optional(),
  pondId: z.string().min(1).max(64).optional(),
  status: z.enum(['online', 'offline']),
  ip: z.string().optional(),
  rssi: z.number().int().optional(),
  uptime: z.number().int().nonnegative().optional(),
});

/** Batas nilai yang masuk akal; di luar ini pembacaan dianggap sensor rusak. */
export const PLAUSIBLE_RANGE = {
  temperature: [-5, 60],       // degC
  ph: [0, 14],
  tds: [0, 5000],              // ppm
  dissolvedOxygen: [0, 25],    // mg/L
  turbidity: [0, 4000],        // NTU
  waterLevel: [0, 500],        // cm
};

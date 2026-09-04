/**
 * Skema topik: fishpond/<pondId>/<deviceId>/<kind>
 * Lihat docs/mqtt-topics.md.
 */
const TOPIC_PATTERN = /^([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/;

/**
 * Mengurai topik menjadi bagian-bagiannya.
 * @returns {{base: string, pondId: string, deviceId: string, kind: string} | null}
 */
export function parseTopic(topic) {
  const match = TOPIC_PATTERN.exec(topic);
  if (!match) return null;
  const [, base, pondId, deviceId, kind] = match;
  return { base, pondId, deviceId, kind };
}

export function buildTopic({ base = 'fishpond', pondId, deviceId, kind }) {
  return `${base}/${pondId}/${deviceId}/${kind}`;
}

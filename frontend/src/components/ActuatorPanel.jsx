import { useState } from 'react';

import { api } from '../api/client.js';

const ACTUATORS = [
  { key: 'aerator', label: 'Aerator', icon: '💨', hint: 'Suplai oksigen terlarut' },
  { key: 'pump', label: 'Pompa air', icon: '🚰', hint: 'Sirkulasi / pengisian air' },
  { key: 'feeder', label: 'Pemberi pakan', icon: '🍚', hint: 'Motor feeder otomatis' },
];

/** Pilihan durasi; menyala dengan durasi akan mati otomatis di device. */
const DURATIONS = [
  { value: '', label: 'Sampai dimatikan' },
  { value: '10', label: '10 detik' },
  { value: '60', label: '1 menit' },
  { value: '600', label: '10 menit' },
  { value: '3600', label: '1 jam' },
];

const COMMAND_TEXT = {
  sent: 'Menunggu konfirmasi perangkat...',
  done: 'Perintah dijalankan',
  failed: 'Perangkat menolak perintah',
  timeout: 'Perangkat tidak merespons',
};

function ActuatorRow({ device, actuator, canControl, command, onSent }) {
  const [duration, setDuration] = useState(actuator.key === 'feeder' ? '10' : '');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  const state = device.actuators?.[actuator.key];
  const known = typeof state === 'boolean';
  const pending = sending || command?.status === 'sent';
  const offline = device.status !== 'online';

  async function send(nextState) {
    setError(null);
    setSending(true);
    try {
      const payload = { actuator: actuator.key, state: nextState };
      if (nextState && duration) payload.durationS = Number(duration);
      onSent(await api.sendCommand(device.id, payload));
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="actuator">
      <div className="actuator__info">
        <span className="actuator__icon" aria-hidden="true">{actuator.icon}</span>
        <div>
          <strong>{actuator.label}</strong>
          <span className="actuator__hint">{actuator.hint}</span>
        </div>
        <span className={`actuator__state${known ? (state ? ' is-on' : ' is-off') : ''}`}>
          {known ? (state ? 'MENYALA' : 'MATI') : 'Tidak diketahui'}
        </span>
      </div>

      {canControl && (
        <div className="actuator__controls">
          <select
            className="input input--small"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            disabled={pending || offline}
            aria-label={`Durasi ${actuator.label}`}
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <button type="button" className="btn btn--small" onClick={() => send(true)} disabled={pending || offline}>
            Nyalakan
          </button>
          <button type="button" className="btn btn--quiet btn--small" onClick={() => send(false)} disabled={pending || offline}>
            Matikan
          </button>
        </div>
      )}

      {(command || error) && (
        <p className={`actuator__feedback actuator__feedback--${error ? 'failed' : command.status}`}>
          {error ?? `${COMMAND_TEXT[command.status]}${command.error ? `: ${command.error}` : ''}`}
        </p>
      )}
    </div>
  );
}

/**
 * Kendali relay satu device. Status dari device (topik .../actuators),
 * hasil perintah dari event `command:updated`.
 *
 * @param commands status perintah realtime { [commandId]: command }
 */
export function ActuatorPanel({ device, canControl, commands }) {
  // Perintah terakhir per aktuator yang dikirim dari tab ini.
  const [lastCommandIds, setLastCommandIds] = useState({});

  return (
    <section className="actuator-panel">
      <header className="actuator-panel__header">
        <h4>{device.name ?? device.id}</h4>
        {device.status !== 'online' && (
          <span className="actuator-panel__note">Perangkat offline — kendali tidak tersedia</span>
        )}
      </header>

      {ACTUATORS.map((actuator) => {
        const sent = lastCommandIds[actuator.key];
        // Event realtime lebih baru dari respons POST; pakai bila sudah ada.
        const command = sent ? commands[sent.id] ?? sent : null;
        return (
          <ActuatorRow
            key={actuator.key}
            device={device}
            actuator={actuator}
            canControl={canControl}
            command={command}
            onSent={(cmd) => setLastCommandIds((all) => ({ ...all, [actuator.key]: cmd }))}
          />
        );
      })}
    </section>
  );
}

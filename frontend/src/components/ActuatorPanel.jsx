import { useState } from 'react';

import { api } from '../api/client.js';
import { useAction } from '../hooks/useAction.js';
import { Icon } from './Icon.jsx';

const ACTUATORS = [
  { key: 'aerator', label: 'Aerator', icon: 'wind', hint: 'Suplai oksigen terlarut' },
  { key: 'pump', label: 'Pompa air', icon: 'droplet', hint: 'Sirkulasi / pengisian air' },
  { key: 'feeder', label: 'Pemberi pakan', icon: 'fish', hint: 'Motor feeder otomatis' },
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
  const { busy, error, run } = useAction(async (state) => {
    const payload = { actuator: actuator.key, state };
    if (state && duration) payload.durationS = Number(duration);
    onSent(await api.sendCommand(device.id, payload));
  });

  const state = device.actuators?.[actuator.key];
  const known = typeof state === 'boolean';
  const disabled = busy || command?.status === 'sent' || device.status !== 'online';
  const feedback = error ?? (command && `${COMMAND_TEXT[command.status]}${command.error ? `: ${command.error}` : ''}`);

  return (
    <div className={`actuator${state ? ' is-on' : ''}`}>
      <div className="actuator__info">
        <span className="actuator__icon">
          <Icon name={actuator.icon} />
        </span>
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
            className="input input--sm"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            disabled={disabled}
            aria-label={`Durasi ${actuator.label}`}
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <button type="button" className="btn btn--sm" onClick={() => run(true)} disabled={disabled}>
            Nyalakan
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => run(false)} disabled={disabled}>
            Matikan
          </button>
        </div>
      )}

      {feedback && (
        <p className={`actuator__feedback is-${error ? 'failed' : command.status}`} role="status">
          {feedback}
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
  const [sentCommands, setSentCommands] = useState({});

  return (
    <section className="card actuator-panel">
      <header className="actuator-panel__header">
        <h4>{device.name ?? device.id}</h4>
        {device.status !== 'online' && (
          <span className="actuator-panel__note">Perangkat offline — kendali tidak tersedia</span>
        )}
      </header>

      {ACTUATORS.map((actuator) => {
        const sent = sentCommands[actuator.key];
        return (
          <ActuatorRow
            key={actuator.key}
            device={device}
            actuator={actuator}
            canControl={canControl}
            // Event realtime lebih baru dari respons POST; pakai bila sudah ada.
            command={sent ? commands[sent.id] ?? sent : null}
            onSent={(cmd) => setSentCommands((all) => ({ ...all, [actuator.key]: cmd }))}
          />
        );
      })}
    </section>
  );
}

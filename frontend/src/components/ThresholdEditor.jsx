import { useEffect, useState } from 'react';

import { api } from '../api/client.js';
import { METRICS } from '../constants/metrics.js';

function ThresholdRow({ metric, threshold, pondId, onSaved }) {
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setMin(threshold ? String(threshold.min) : '');
    setMax(threshold ? String(threshold.max) : '');
  }, [threshold]);

  const dirty = threshold && (Number(min) !== Number(threshold.min) || Number(max) !== Number(threshold.max));

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      onSaved(await action());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const save = () => run(() => api.setThreshold(metric.key, { pondId, min: Number(min), max: Number(max) }));
  const reset = () => run(() => api.resetThreshold(metric.key, pondId));

  return (
    <tr>
      <td>
        <span className="table__primary">{metric.label}</span>
        <span className="table__secondary">
          {threshold?.source === 'pond' ? 'Khusus kolam ini' : 'Default semua kolam'}
        </span>
      </td>
      <td>
        <input
          className="input input--small"
          type="number"
          step="any"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          aria-label={`Batas bawah ${metric.label}`}
        />
      </td>
      <td>
        <input
          className="input input--small"
          type="number"
          step="any"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          aria-label={`Batas atas ${metric.label}`}
        />
      </td>
      <td>{metric.unit || '—'}</td>
      <td className="table__actions">
        <button type="button" className="btn btn--small" onClick={save} disabled={!dirty || busy}>
          Simpan
        </button>
        {threshold?.source === 'pond' && (
          <button type="button" className="btn btn--quiet btn--small" onClick={reset} disabled={busy}>
            Pakai default
          </button>
        )}
        {error && <p className="form-error">{error}</p>}
      </td>
    </tr>
  );
}

/**
 * Pengaturan rentang aman per kolam (admin). Perubahan langsung dipakai
 * kartu metrik, grafik, dan evaluasi alert di backend.
 */
export function ThresholdEditor({ pondId, thresholds, onChange }) {
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Batas bawah</th>
            <th>Batas atas</th>
            <th>Satuan</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {METRICS.map((metric) => (
            <ThresholdRow
              key={metric.key}
              metric={metric}
              threshold={thresholds?.[metric.key]}
              pondId={pondId}
              onSaved={onChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

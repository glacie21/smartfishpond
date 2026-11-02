import { useEffect, useState } from 'react';

import { api } from '../api/client.js';
import { METRICS } from '../constants/metrics.js';
import { useAction } from '../hooks/useAction.js';

function ThresholdRow({ metric, threshold, pondId, onSaved }) {
  const [values, setValues] = useState({ min: '', max: '' });
  const { busy, error, run } = useAction(async (action) => onSaved(await action()));

  useEffect(() => {
    setValues({ min: threshold ? String(threshold.min) : '', max: threshold ? String(threshold.max) : '' });
  }, [threshold]);

  const min = Number(values.min);
  const max = Number(values.max);
  const dirty = threshold && (min !== Number(threshold.min) || max !== Number(threshold.max));
  const invalid = values.min === '' || values.max === '' || !(min < max);
  const custom = threshold?.source === 'pond';

  const input = (key, label) => (
    <input
      className={`input input--sm${dirty && invalid ? ' is-invalid' : ''}`}
      type="number"
      step="any"
      value={values[key]}
      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
      aria-label={`${label} ${metric.label}`}
    />
  );

  return (
    <tr>
      <td>
        <span className="table__primary">{metric.label}</span>
        <span className="table__secondary">{custom ? 'Khusus kolam ini' : 'Default semua kolam'}</span>
      </td>
      <td>{input('min', 'Batas bawah')}</td>
      <td>{input('max', 'Batas atas')}</td>
      <td>{metric.unit || '—'}</td>
      <td className="table__actions">
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => run(() => api.setThreshold(metric.key, { pondId, min, max }))}
          disabled={!dirty || invalid || busy}
        >
          Simpan
        </button>
        {custom && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => run(() => api.resetThreshold(metric.key, pondId))}
            disabled={busy}
          >
            Pakai default
          </button>
        )}
        {dirty && invalid && <p className="form-error">Batas bawah harus lebih kecil dari batas atas.</p>}
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
    <div className="card table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Batas bawah</th>
            <th>Batas atas</th>
            <th>Satuan</th>
            <th aria-label="Aksi" />
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

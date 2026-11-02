import { api } from '../api/client.js';
import { useAction } from '../hooks/useAction.js';
import { Field } from './ui.jsx';

/** Field kosong tidak dikirim agar backend memakai nilai lama/default. */
function readForm(form) {
  const values = Object.fromEntries(
    [...new FormData(form)].map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== ''),
  );
  if (values.depthCm) values.depthCm = Number(values.depthCm);
  return values;
}

/**
 * Form tambah/ubah kolam (admin). `pond` kosong = mode tambah.
 * Kolam yang dibuat otomatis oleh telemetri bernama sama dengan id-nya;
 * form ini tempat memberi nama, lokasi, dan komoditasnya.
 */
export function PondForm({ pond, onDone, onCancel }) {
  const editing = Boolean(pond);
  const { busy, error, run } = useAction(async (values) =>
    onDone(editing ? await api.updatePond(pond.id, values) : await api.createPond(values)),
  );

  return (
    <form
      className="card form-card"
      onSubmit={(event) => {
        event.preventDefault();
        run(readForm(event.currentTarget));
      }}
    >
      <h3 className="form-card__title">{editing ? `Ubah ${pond.name}` : 'Tambah kolam'}</h3>
      <div className="form-grid">
        {!editing && (
          <Field label="ID kolam" hint="Sama dengan POND_ID di firmware">
            <input className="input" name="id" placeholder="pond-03" pattern="[a-zA-Z0-9_\-]+" required />
          </Field>
        )}
        <Field label="Nama">
          <input className="input" name="name" defaultValue={pond?.name} placeholder="Kolam C" required={!editing} />
        </Field>
        <Field label="Lokasi">
          <input className="input" name="location" defaultValue={pond?.location ?? ''} placeholder="Blok utara" />
        </Field>
        <Field label="Komoditas">
          <input className="input" name="fishType" defaultValue={pond?.fish_type ?? ''} placeholder="Nila" />
        </Field>
        <Field label="Kedalaman (cm)">
          <input
            className="input"
            name="depthCm"
            type="number"
            min="1"
            max="2000"
            step="any"
            defaultValue={pond?.depth_cm ?? ''}
          />
        </Field>
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Menyimpan...' : 'Simpan'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Batal
        </button>
      </div>
    </form>
  );
}

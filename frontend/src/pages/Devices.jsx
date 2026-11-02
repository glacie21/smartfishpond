import { useState } from 'react';

import { api } from '../api/client.js';
import { DeviceTable } from '../components/DeviceTable.jsx';
import { Icon } from '../components/Icon.jsx';
import { ErrorState, Loading } from '../components/StateViews.jsx';
import { Field, PageHeader, Segmented } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAction } from '../hooks/useAction.js';
import { useApi } from '../hooks/useApi.js';

/**
 * Form tambah/ubah device. `device` kosong = mode tambah.
 * Kolam device terkunci: paket dari kolam lain ditolak backend, jadi saat
 * memindah kolam POND_ID di firmware juga harus diganti.
 */
function DeviceForm({ device, ponds, onDone, onCancel }) {
  const editing = Boolean(device);
  const [pondId, setPondId] = useState(device?.pond_id ?? ponds[0]?.id ?? '');
  const { busy, error, run } = useAction(async (form) => {
    const name = form.get('name').trim() || undefined;
    if (editing) await api.updateDevice(device.id, { name, pondId });
    else await api.createDevice({ id: form.get('id').trim(), pondId, name });
    onDone();
  });
  const movingPond = editing && pondId !== device.pond_id;

  return (
    <form
      className="card form-card"
      onSubmit={(event) => {
        event.preventDefault();
        run(new FormData(event.currentTarget));
      }}
    >
      <h3 className="form-card__title">{editing ? `Ubah ${device.id}` : 'Daftarkan perangkat'}</h3>
      <div className="form-grid">
        <Field label="ID perangkat">
          <input
            className="input"
            name="id"
            defaultValue={device?.id}
            placeholder="esp32-node-03"
            pattern="[a-zA-Z0-9_\-]+"
            required
            disabled={editing}
          />
        </Field>
        <Field label="Nama">
          <input className="input" name="name" defaultValue={device?.name ?? ''} placeholder="Node Kolam C" />
        </Field>
        <Field label="Kolam">
          <select className="input" value={pondId} onChange={(e) => setPondId(e.target.value)} required>
            {ponds.map((pond) => (
              <option key={pond.id} value={pond.id}>
                {pond.name} ({pond.id})
              </option>
            ))}
          </select>
        </Field>
      </div>

      {!editing && (
        <p className="form-hint">
          ID harus sama dengan <code>DEVICE_ID</code> di firmware dan username MQTT-nya di{' '}
          <code>docker/mosquitto/credentials</code>.
        </p>
      )}
      {movingPond && (
        <p className="banner is-warning">
          Setelah dipindah, ganti <code>POND_ID</code> di firmware menjadi <code>{pondId}</code> — paket dari kolam
          lama akan ditolak.
        </p>
      )}
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

/** Daftar seluruh node dari semua kolam; admin bisa menambah, mengubah, dan menghapus. */
export function Devices() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data, loading, error, refetch } = useApi(async () => {
    const [devices, ponds] = await Promise.all([api.listDevices(), api.listPonds()]);
    return { devices, ponds };
  }, []);
  // null = form tertutup, 'new' = tambah, objek device = ubah.
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const remove = useAction(async (device) => {
    await api.deleteDevice(device.id);
    await refetch({ silent: true });
  });

  if (loading) return <Loading label="Memuat perangkat..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const { devices, ponds } = data;
  const pondNames = Object.fromEntries(ponds.map((p) => [p.id, p.name]));
  const online = devices.filter((d) => d.status === 'online').length;
  const needle = query.trim().toLowerCase();
  const visible = devices.filter(
    (d) =>
      (status === 'all' || d.status === status) &&
      (!needle || [d.id, d.name, pondNames[d.pond_id]].some((v) => v?.toLowerCase().includes(needle))),
  );

  function handleDelete(device) {
    const confirmed = window.confirm(
      `Hapus ${device.name ?? device.id}? Seluruh riwayat pembacaan dan alert perangkat ini ikut terhapus.\n\n` +
        'Bila perangkat masih menyala dan kredensial MQTT-nya belum dicabut, ia akan terdaftar lagi otomatis.',
    );
    if (confirmed) remove.run(device);
  }

  return (
    <>
      <PageHeader
        eyebrow="Manajemen"
        title="Perangkat IoT"
        subtitle={`${devices.length} node ESP32 terdaftar · ${online} online`}
      >
        {isAdmin && !editing && (
          <button type="button" className="btn" onClick={() => setEditing('new')} disabled={!ponds.length}>
            <Icon name="plus" size={16} /> Daftarkan perangkat
          </button>
        )}
      </PageHeader>

      {editing && (
        <DeviceForm
          key={editing === 'new' ? 'new' : editing.id}
          device={editing === 'new' ? null : editing}
          ponds={ponds}
          onDone={() => {
            setEditing(null);
            refetch({ silent: true });
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {remove.error && <p className="form-error">{remove.error}</p>}

      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <input
            className="input"
            type="search"
            placeholder="Cari id, nama, atau kolam..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cari perangkat"
          />
        </label>
        <Segmented
          label="Filter status"
          value={status}
          onChange={setStatus}
          options={[
            { id: 'all', label: 'Semua', count: devices.length },
            { id: 'online', label: 'Online', count: online },
            { id: 'offline', label: 'Offline', count: devices.length - online },
          ]}
        />
      </div>

      <DeviceTable
        devices={visible}
        emptyText={devices.length ? 'Tidak ada perangkat yang cocok dengan filter.' : undefined}
        pondNames={pondNames}
        renderActions={
          isAdmin &&
          ((device) => (
            <>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setEditing(device)}
                aria-label={`Ubah ${device.name ?? device.id}`}
                title="Ubah"
              >
                <Icon name="pencil" size={16} />
              </button>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                onClick={() => handleDelete(device)}
                disabled={remove.busy}
                aria-label={`Hapus ${device.name ?? device.id}`}
                title="Hapus"
              >
                <Icon name="trash" size={16} />
              </button>
            </>
          ))
        }
      />
    </>
  );
}

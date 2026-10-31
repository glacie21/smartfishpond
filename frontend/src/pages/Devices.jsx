import { useState } from 'react';

import { api } from '../api/client.js';
import { DeviceTable } from '../components/DeviceTable.jsx';
import { ErrorState, Loading } from '../components/StateViews.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';

/**
 * Form tambah/ubah device. `device` kosong = mode tambah.
 * Kolam device terkunci: paket dari kolam lain ditolak backend, jadi saat
 * memindah kolam POND_ID di firmware juga harus diganti.
 */
function DeviceForm({ device, ponds, onDone, onCancel }) {
  const editing = Boolean(device);
  const [id, setId] = useState(device?.id ?? '');
  const [name, setName] = useState(device?.name ?? '');
  const [pondId, setPondId] = useState(device?.pond_id ?? ponds[0]?.id ?? '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await api.updateDevice(device.id, { name: name || undefined, pondId });
      } else {
        await api.createDevice({ id, pondId, name: name || undefined });
      }
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const movingPond = editing && pondId !== device.pond_id;

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h3 className="form-card__title">{editing ? `Ubah ${device.id}` : 'Daftarkan perangkat'}</h3>
      <div className="form-grid">
        <label className="form-field">
          <span>ID perangkat</span>
          <input
            className="input"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="esp32-node-03"
            pattern="[a-zA-Z0-9_\-]+"
            required
            disabled={editing}
          />
        </label>
        <label className="form-field">
          <span>Nama</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Node Kolam C" />
        </label>
        <label className="form-field">
          <span>Kolam</span>
          <select className="input" value={pondId} onChange={(e) => setPondId(e.target.value)} required>
            {ponds.map((pond) => (
              <option key={pond.id} value={pond.id}>{pond.name} ({pond.id})</option>
            ))}
          </select>
        </label>
      </div>

      {!editing && (
        <p className="form-hint">
          ID harus sama dengan <code>DEVICE_ID</code> di firmware dan username MQTT-nya di{' '}
          <code>docker/mosquitto/credentials</code>.
        </p>
      )}
      {movingPond && (
        <p className="form-hint form-hint--warning">
          Setelah dipindah, ganti <code>POND_ID</code> di firmware menjadi <code>{pondId}</code> — paket dari
          kolam lama akan ditolak.
        </p>
      )}
      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Menyimpan...' : 'Simpan'}
        </button>
        <button type="button" className="btn btn--quiet" onClick={onCancel}>
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
  const { data, loading, error, refetch } = useApi(
    async () => {
      const [devices, ponds] = await Promise.all([api.listDevices(), api.listPonds()]);
      return { devices, ponds };
    },
    [],
  );
  // null = form tertutup, 'new' = tambah, objek device = ubah.
  const [editing, setEditing] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (loading) return <Loading label="Memuat perangkat..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const { devices, ponds } = data;

  async function handleDelete(device) {
    const confirmed = window.confirm(
      `Hapus ${device.name ?? device.id}? Seluruh riwayat pembacaan dan alert perangkat ini ikut terhapus.\n\n` +
        'Bila perangkat masih menyala dan kredensial MQTT-nya belum dicabut, ia akan terdaftar lagi otomatis.',
    );
    if (!confirmed) return;
    setActionError(null);
    try {
      await api.deleteDevice(device.id);
      refetch();
    } catch (err) {
      setActionError(err.message);
    }
  }

  function handleDone() {
    setEditing(null);
    refetch();
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Manajemen</p>
          <h2 className="page-header__title">Perangkat IoT</h2>
          <p className="page-header__subtitle">
            📡 {devices.length} node ESP32 terdaftar dalam sistem
          </p>
        </div>
        {isAdmin && !editing && (
          <button type="button" className="btn" onClick={() => setEditing('new')} disabled={!ponds.length}>
            + Daftarkan perangkat
          </button>
        )}
      </div>

      {editing && (
        <DeviceForm
          key={editing === 'new' ? 'new' : editing.id}
          device={editing === 'new' ? null : editing}
          ponds={ponds}
          onDone={handleDone}
          onCancel={() => setEditing(null)}
        />
      )}
      {actionError && <p className="form-error">{actionError}</p>}

      <DeviceTable
        devices={devices}
        renderActions={
          isAdmin
            ? (device) => (
                <>
                  <button type="button" className="btn btn--quiet btn--small" onClick={() => setEditing(device)}>
                    Ubah
                  </button>
                  <button type="button" className="btn btn--danger btn--small" onClick={() => handleDelete(device)}>
                    Hapus
                  </button>
                </>
              )
            : undefined
        }
      />
    </>
  );
}

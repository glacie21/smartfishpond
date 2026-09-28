import { api } from '../api/client.js';
import { DeviceTable } from '../components/DeviceTable.jsx';
import { ErrorState, Loading } from '../components/StateViews.jsx';
import { useApi } from '../hooks/useApi.js';

/** Daftar seluruh node dari semua kolam. */
export function Devices() {
  const { data, loading, error, refetch } = useApi(() => api.listDevices(), []);

  if (loading) return <Loading label="Memuat perangkat..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Manajemen</p>
          <h2 className="page-header__title">Perangkat IoT</h2>
          <p className="page-header__subtitle">
            📡 {data?.length ?? 0} node ESP32 terdaftar dalam sistem
          </p>
        </div>
      </div>
      <DeviceTable devices={data} />
    </>
  );
}

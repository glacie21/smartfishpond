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
        <h2 className="page-header__title">Perangkat</h2>
        <p className="page-header__subtitle">{data?.length ?? 0} node terdaftar</p>
      </div>
      <DeviceTable devices={data} />
    </>
  );
}

import { METRICS } from '../constants/metrics.js';
import { MetricCard } from './MetricCard.jsx';

/** Grid enam kartu metrik dari satu baris pembacaan. */
export function MetricGrid({ reading }) {
  return (
    <div className="metric-grid">
      {METRICS.map((metric) => (
        <MetricCard key={metric.key} metric={metric} value={reading?.[metric.key] ?? null} />
      ))}
    </div>
  );
}

import { METRICS, rangeFor } from '../constants/metrics.js';
import { MetricCard } from './MetricCard.jsx';

/** Grid enam kartu metrik dari satu baris pembacaan. */
export function MetricGrid({ reading, thresholds }) {
  return (
    <div className="metric-grid">
      {METRICS.map((metric) => (
        <MetricCard
          key={metric.key}
          metric={metric}
          value={reading?.[metric.key] ?? null}
          range={rangeFor(metric.key, thresholds)}
        />
      ))}
    </div>
  );
}

import { evaluateMetric, formatMetric } from '../constants/metrics.js';
import { StatusBadge } from './StatusBadge.jsx';

/**
 * Kartu satu parameter kualitas air: nilai terkini, satuan, status
 * terhadap rentang aman, dan rentang acuannya.
 */
export function MetricCard({ metric, value }) {
  const status = evaluateMetric(metric.key, value);
  const [min, max] = metric.safeRange;

  return (
    <article className={`metric-card metric-card--${status}`}>
      <header className="metric-card__header">
        <h3 className="metric-card__label">{metric.label}</h3>
        <StatusBadge status={status} />
      </header>

      <p className="metric-card__value" style={{ color: metric.color }}>
        {formatMetric(metric.key, value)}
        <span className="metric-card__unit">{metric.unit}</span>
      </p>

      <footer className="metric-card__range">
        Aman: {min}-{max} {metric.unit}
      </footer>
    </article>
  );
}

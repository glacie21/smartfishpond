import { evaluateMetric, formatMetric } from '../constants/metrics.js';
import { StatusBadge } from './StatusBadge.jsx';

/**
 * Kartu satu parameter kualitas air: nilai terkini, satuan, status
 * terhadap rentang aman, dan rentang acuannya. Dilengkapi mini gauge.
 */
export function MetricCard({ metric, value }) {
  const status = evaluateMetric(metric.key, value);
  const [min, max] = metric.safeRange;

  // Hitung persentase posisi nilai di rentang aman untuk mini gauge
  const safeSpan = max - min;
  const numericValue = value != null ? Number(value) : null;
  let gaugePercent = 50;
  if (numericValue != null && safeSpan > 0) {
    gaugePercent = Math.max(0, Math.min(100, ((numericValue - min) / safeSpan) * 100));
  }

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

      {/* Mini gauge bar */}
      {numericValue != null && (
        <div className="metric-card__gauge" aria-hidden="true">
          <div
            className="metric-card__gauge-fill"
            style={{
              width: `${gaugePercent}%`,
              background: metric.color,
            }}
          />
          <div
            className="metric-card__gauge-marker"
            style={{
              left: `${gaugePercent}%`,
              borderColor: metric.color,
            }}
          />
        </div>
      )}

      <footer className="metric-card__range">
        Aman: {min}–{max} {metric.unit}
      </footer>
    </article>
  );
}

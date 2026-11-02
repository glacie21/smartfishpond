import { evaluateMetric, formatMetric, METRICS, rangeFor } from '../constants/metrics.js';
import { Icon } from './Icon.jsx';
import { StatusBadge } from './StatusBadge.jsx';

/**
 * Posisi nilai (0–100%) pada skala yang melebar setengah rentang aman di
 * kedua sisi, sehingga pita aman selalu berada di 25–75% dan nilai di luar
 * batas tetap terlihat seberapa jauh menyimpangnya.
 */
function gaugePosition(value, [min, max]) {
  const span = max - min;
  if (!(span > 0)) return 50;
  return Math.max(0, Math.min(100, ((value - (min - span / 2)) / (span * 2)) * 100));
}

/** Kartu satu parameter kualitas air: nilai terkini, status, dan gauge rentang aman. */
export function MetricCard({ metric, value, range = metric.safeRange }) {
  const status = evaluateMetric(metric.key, value, range);
  const hasValue = value !== null && value !== undefined;
  const [min, max] = range;

  return (
    <article className={`card metric-card is-${status}`} style={{ '--metric-color': metric.color }}>
      <header className="metric-card__header">
        <span className="metric-card__icon">
          <Icon name={metric.icon} />
        </span>
        <h3 className="metric-card__label">{metric.label}</h3>
        <StatusBadge status={status} />
      </header>

      <p className="metric-card__value">
        {formatMetric(metric.key, value)}
        {metric.unit && <span className="metric-card__unit">{metric.unit}</span>}
      </p>

      <div className="gauge" aria-hidden="true">
        <span className="gauge__safe" />
        {hasValue && <span className="gauge__marker" style={{ left: `${gaugePosition(Number(value), range)}%` }} />}
      </div>

      <footer className="metric-card__range">
        Aman {min}–{max} {metric.unit}
      </footer>
    </article>
  );
}

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

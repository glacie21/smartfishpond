import { useId } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatMetric, METRIC_BY_KEY } from '../constants/metrics.js';
import { formatClock, formatDayClock } from '../lib/format.js';
import { Icon } from './Icon.jsx';

const TOOLTIP_STYLE = {
  background: 'var(--surface-solid)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  boxShadow: 'var(--shadow)',
};

/**
 * Grafik tren satu metrik.
 *
 * @param metricKey kunci metrik (mis. 'temperature')
 * @param data      baris dengan `bucket`/`recorded_at` dan kolom nilai
 * @param valueKey  kolom nilai — `<metricKey>_avg` untuk data agregat
 * @param range     rentang aman [min, max]; default `safeRange` bawaan
 * @param multiDay  rentang > 1 hari: sumbu waktu menampilkan tanggal
 */
export function TrendChart({ metricKey, data, valueKey = metricKey, range, multiDay = false }) {
  const metric = METRIC_BY_KEY[metricKey];
  const gradientId = useId();
  const [safeMin, safeMax] = range ?? metric.safeRange;

  const points = (data ?? [])
    .map((row) => ({
      time: new Date(row.bucket ?? row.recorded_at).getTime(),
      value: row[valueKey] == null ? null : Number(row[valueKey]),
    }))
    .filter((p) => Number.isFinite(p.time));
  const values = points.map((p) => p.value).filter((v) => v !== null);
  const stats = values.length
    ? {
        min: Math.min(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        max: Math.max(...values),
      }
    : null;

  return (
    <section className="card chart-card" style={{ '--metric-color': metric.color }}>
      <header className="chart-card__header">
        <h3 className="chart-card__title">
          <Icon name={metric.icon} />
          {metric.label}
          {metric.unit && <span className="muted">({metric.unit})</span>}
        </h3>
        {stats && (
          <dl className="chart-card__stats">
            {Object.entries({ min: 'Min', avg: 'Rata²', max: 'Maks' }).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{formatMetric(metricKey, stats[key])}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {!stats ? (
        <p className="chart-card__empty">Belum ada data pada rentang ini.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metric.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={metric.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            {/* Pita rentang aman sebagai konteks di belakang garis. */}
            <ReferenceArea y1={safeMin} y2={safeMax} fill="var(--normal)" fillOpacity={0.07} />
            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
              tickFormatter={multiDay ? formatDayClock : formatClock}
              stroke="var(--text-muted)"
              fontSize={11}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis stroke="var(--text-muted)" fontSize={11} width={52} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
            <Tooltip
              labelFormatter={formatDayClock}
              formatter={(value) => [`${formatMetric(metricKey, value)} ${metric.unit}`, metric.label]}
              contentStyle={TOOLTIP_STYLE}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={metric.color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

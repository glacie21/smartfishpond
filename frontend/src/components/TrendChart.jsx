import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { METRIC_BY_KEY } from '../constants/metrics.js';

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
});

const fullFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Grafik tren satu metrik.
 *
 * @param metricKey kunci metrik (mis. 'temperature')
 * @param data      array baris; tiap baris punya `bucket`/`recorded_at`
 *                  dan kolom nilai
 * @param valueKey  nama kolom nilai — `<metricKey>_avg` untuk data agregat,
 *                  atau `metricKey` untuk data mentah
 */
export function TrendChart({ metricKey, data, valueKey }) {
  const metric = METRIC_BY_KEY[metricKey];
  const field = valueKey ?? metricKey;
  const [safeMin, safeMax] = metric.safeRange;

  const points = (data ?? [])
    .map((row) => ({
      time: new Date(row.bucket ?? row.recorded_at).getTime(),
      value: row[field] === null || row[field] === undefined ? null : Number(row[field]),
    }))
    .filter((p) => Number.isFinite(p.time));

  if (points.length === 0) {
    return (
      <section className="chart-card">
        <h3 className="chart-card__title">{metric.label}</h3>
        <p className="chart-card__empty">Belum ada data pada rentang ini.</p>
      </section>
    );
  }

  return (
    <section className="chart-card">
      <h3 className="chart-card__title">
        {metric.label} {metric.unit && <span className="chart-card__unit">({metric.unit})</span>}
      </h3>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />

          {/* Pita rentang aman sebagai konteks di belakang garis. */}
          <ReferenceArea y1={safeMin} y2={safeMax} fill={metric.color} fillOpacity={0.08} />

          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={(t) => timeFormatter.format(new Date(t))}
            stroke="var(--text-muted)"
            fontSize={12}
          />
          <YAxis stroke="var(--text-muted)" fontSize={12} width={52} domain={['auto', 'auto']} />
          <Tooltip
            labelFormatter={(t) => fullFormatter.format(new Date(t))}
            formatter={(value) => [
              Number(value).toFixed(metric.decimals) + ' ' + metric.unit,
              metric.label,
            ]}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text)',
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={metric.color}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

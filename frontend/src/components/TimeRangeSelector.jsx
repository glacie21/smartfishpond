import { TIME_RANGES } from '../hooks/useTimeRange.js';

/** Tombol pilihan rentang waktu grafik. */
export function TimeRangeSelector({ value, onChange }) {
  return (
    <div className="range-selector" role="group" aria-label="Rentang waktu">
      {TIME_RANGES.map((range) => (
        <button
          key={range.id}
          type="button"
          className={`range-selector__btn${value === range.id ? ' is-active' : ''}`}
          onClick={() => onChange(range.id)}
          aria-pressed={value === range.id}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

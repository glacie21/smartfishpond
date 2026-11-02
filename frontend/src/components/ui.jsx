import { Link } from 'react-router-dom';

import { Icon } from './Icon.jsx';

/** Judul halaman: eyebrow/tautan kembali, judul, subjudul, dan aksi di kanan. */
export function PageHeader({ eyebrow, back, title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        {back && (
          <Link to={back.to} className="page-header__back">
            <Icon name="back" size={16} /> {back.label}
          </Link>
        )}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="page-header__title">{title}</h2>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {children && <div className="page-header__actions">{children}</div>}
    </div>
  );
}

/** Judul bagian di dalam halaman, opsional dengan ikon dan elemen di kanan. */
export function SectionHeader({ icon, title, children }) {
  return (
    <div className="section-header">
      <h3 className="section-header__title">
        {icon && <Icon name={icon} />}
        {title}
      </h3>
      {children}
    </div>
  );
}

/**
 * Kelompok tombol pilihan tunggal (rentang waktu, tab status, dll.).
 * @param options [{ id, label, count? }]
 */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`segmented__btn${value === option.id ? ' is-active' : ''}`}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
          {option.count != null && <span className="segmented__count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Field form berlabel. */
export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

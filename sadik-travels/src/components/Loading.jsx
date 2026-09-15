import { useI18n } from '../i18n/index.jsx'

export function Skeleton({ rows = 4, className = '' }) {
  return (
    <div className={`skeleton ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <span key={i} className="skeleton-row" style={{ width: `${92 - i * 7}%` }} />
      ))}
    </div>
  )
}

export default function Loading({ full = false, label }) {
  const { t } = useI18n()
  return (
    <div className={full ? 'loading loading-full' : 'loading'} role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label || t('loading')}</span>
    </div>
  )
}

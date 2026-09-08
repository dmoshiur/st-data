export default function Loading({ full = false }) {
  return (
    <div className={full ? 'loading loading-full' : 'loading'}>
      <div className="spinner" aria-hidden="true" />
      <span>Loading…</span>
    </div>
  )
}

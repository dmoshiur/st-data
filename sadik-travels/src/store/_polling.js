import { useEffect, useRef, useState } from 'react'

// Generic polling hook used by the real (Turso/Netlify) backend.
export function usePolling(fetcher, deps = [], interval = 15000) {
  const [data, setData] = useState(undefined)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    let cancelled = false
    let timer = null

    async function run() {
      try {
        const value = await fetcherRef.current()
        if (!cancelled) { setData(value); setError(''); setLoading(false) }
      } catch (e) {
        if (!cancelled) { setError(e.message); setLoading(false) }
      }
    }
    run()
    if (interval > 0) timer = setInterval(run, interval)
    return () => { cancelled = true; if (timer) clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading }
}

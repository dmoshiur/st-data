import { useEffect, useRef, useState } from 'react'

/**
 * Subscribe to a live data source and keep {data, error, loading} in state.
 *
 * `factory(emit)` must return an unsubscribe function. `emit` is called with
 * a partial `{ data, error, loading }` whenever the source changes.
 */
export function useSubscribe(factory, deps = []) {
  const [state, setState] = useState({ data: undefined, error: '', loading: true })
  const factoryRef = useRef(factory)
  factoryRef.current = factory

  useEffect(() => {
    let alive = true
    setState((prev) => ({ data: prev.data, error: '', loading: true }))
    let unsub = () => {}
    const emit = (patch) => {
      if (!alive) return
      // Any emit ends the loading state unless it explicitly says otherwise.
      setState((prev) => ({
        data: patch.data !== undefined ? patch.data : prev.data,
        error: patch.error || '',
        loading: patch.loading !== undefined ? patch.loading : false,
      }))
    }
    try {
      const result = factoryRef.current(emit)
      if (typeof result === 'function') unsub = result
    } catch (e) {
      emit({ error: (e && e.message) || 'Subscription failed', loading: false })
    }
    return () => {
      alive = false
      try {
        unsub()
      } catch (_e) {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}

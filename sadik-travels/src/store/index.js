import { isFirebaseConfigured } from '../lib/firebase.js'
import { firebaseBackend } from './firebaseBackend.js'
import { demoBackend } from './demoBackend.js'
import { useSubscribe } from './subscribe.js'

/**
 * The active backend. Chosen once at module load from the resolved Firebase
 * config: Firebase when it is configured, the localStorage demo store when it
 * is not. Pages never branch on this.
 */
export const backend = isFirebaseConfigured ? firebaseBackend : demoBackend
export const isDemoMode = backend.kind === 'demo'

/* ------------------------------ live reads ------------------------------ */

export function useFunders() {
  return useSubscribe(backend.subscribeFunders, [backend])
}

export function useMonthDonations(month) {
  return useSubscribe((emit) => backend.subscribeMonth(month, emit), [backend, month])
}

export function useTotals() {
  return useSubscribe(backend.subscribeTotals, [backend])
}

export function useAdmins() {
  return useSubscribe(backend.subscribeAdmins, [backend])
}

export { computeTotals, monthKey, monthLabel, shiftMonthKey, MONTH_NAMES } from './totals.js'

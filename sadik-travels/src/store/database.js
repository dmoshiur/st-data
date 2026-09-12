// Unified data hooks — callers get live data whether the real Turso backend
// is configured or the browser-only demo store is active.
import { useEffect, useState } from 'react'
import { api } from './api'
import { usePolling } from './_polling.js'
import {
  demoFunders,
  demoDonations,
  demoAdmins,
  useDemo,
} from './demoData.js'
import { useAuth } from '../context/AuthContext'

// A tiny hook that returns true once we know whether the real backend is on.
export function useConfigured() {
  const { configured } = useAuth()
  return !!configured
}

// ---- Funders ----
export function useFunders() {
  const configured = useConfigured()
  const real = usePolling(() => api.listFunders(), [configured], 15000)
  const demo = useDemo(() => demoFunders.list(), [configured])
  return configured ? real : demo
}

// ---- Donations (by month) ----
export function useMonthDonations(month) {
  const configured = useConfigured()
  const real = usePolling(() => api.getMonth(month), [configured, month], 10000)
  const demo = useDemo(() => demoDonations.getMonth(month), [configured, month])
  return configured ? real : demo
}

// ---- Totals (dashboard) ----
export function useTotals() {
  const configured = useConfigured()
  const real = usePolling(() => api.getTotals(), [configured], 15000)
  const demo = useDemo(() => demoDonations.getTotals(), [configured])
  return configured ? real : demo
}

// ---- Admins ----
export function useAdmins() {
  const configured = useConfigured()
  const real = usePolling(() => api.listAdmins(), [configured], 20000)
  const demo = useDemo(() => demoAdmins.list(), [configured])
  return configured ? real : demo
}

// ---- Mutations (auto-switching) ----
export const mutations = {
  async createFunder(data) {
    const configured = (await api.health()).configured
    if (configured) return api.createFunder(data)
    return demoFunders.create(data)
  },
  async updateFunder(id, data) {
    const configured = (await api.health()).configured
    if (configured) return api.updateFunder(id, data)
    return demoFunders.update(id, data)
  },
  async deleteFunder(id) {
    const configured = (await api.health()).configured
    if (configured) return api.deleteFunder(id)
    return demoFunders.remove(id)
  },
  async saveMonth(month, payload) {
    const configured = (await api.health()).configured
    if (configured) return api.saveMonth(month, payload)
    return demoDonations.saveMonth(month, payload)
  },
  async createAdmin(data) {
    const configured = (await api.health()).configured
    if (configured) return api.createAdmin(data)
    return demoAdmins.create(data)
  },
  async updateAdmin(id, data) {
    const configured = (await api.health()).configured
    if (configured) return api.updateAdmin(id, data)
    return demoAdmins.update(id, data)
  },
  async deleteAdmin(id, currentUserId) {
    const configured = (await api.health()).configured
    if (configured) return api.deleteAdmin(id)
    return demoAdmins.remove(id, currentUserId)
  },
  async changePassword(id, currentPassword, newPassword) {
    const configured = (await api.health()).configured
    if (configured) return api.changePassword(id, currentPassword, newPassword)
    return demoAdmins.changePassword(id, currentPassword, newPassword)
  },
}

// Keep this tiny helper here so demoData.js doesn't have to re-define it.
export function useOnce(fn, deps = []) {
  useEffect(() => { fn(); /* eslint-disable-next-line */ }, deps)
}
export function useLocalState(key, initial) {
  const [v, setV] = useState(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial }
    catch (_e) { return initial }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)) } catch (_e) { /* ignore */ }
  }, [key, v])
  return [v, setV]
}

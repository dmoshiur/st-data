import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Icon } from './Icons.jsx'
import { useT } from '../i18n/index.jsx'

/* ------------------------------------------------------------------ *
 * Toasts
 * ------------------------------------------------------------------ */

const ToastContext = createContext(null)

let toastSeq = 0

function ToastHost({ toasts, dismiss }) {
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type} toast-enter`}>
          <Icon
            name={t.type === 'error' ? 'alert' : t.type === 'success' ? 'check' : 'info'}
            size={17}
          />
          <span className="toast-body">{t.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Confirm dialog
 * ------------------------------------------------------------------ */

const ConfirmContext = createContext(null)

function ConfirmDialog({ state, onCancel, onConfirm }) {
  const t = useT()
  const ref = useRef(null)

  useEffect(() => {
    if (!state.open) return
    const el = ref.current
    if (el) el.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.open, onCancel])

  if (!state.open) return null

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={state.title}
        ref={ref}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className={`modal-icon ${state.danger ? 'danger' : ''}`}>
            <Icon name={state.danger ? 'alert' : 'info'} size={20} />
          </span>
          <h3>{state.title}</h3>
        </div>
        {state.body && <p className="modal-body">{state.body}</p>}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className={`btn ${state.danger ? 'danger-solid' : 'primary'}`}
            onClick={onConfirm}
          >
            {state.confirmLabel || t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Provider
 * ------------------------------------------------------------------ */

export function FeedbackProvider({ children }) {
  const t = useT()
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState({ open: false })
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((x) => x.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (message, type = 'info', ms = 4200) => {
      if (!message) return
      const id = ++toastSeq
      setToasts((prev) => [...prev.slice(-3), { id, message, type }])
      if (ms > 0) {
        const timer = setTimeout(() => dismiss(id), ms)
        timers.current.set(id, timer)
      }
    },
    [dismiss],
  )

  useEffect(() => {
    const map = timers.current
    return () => map.forEach((timer) => clearTimeout(timer))
  }, [])

  const toast = useMemo(
    () => ({
      push,
      dismiss,
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error', 6500),
      info: (m) => push(m, 'info'),
    }),
    [push, dismiss],
  )

  const confirmResolver = useRef(null)

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        confirmResolver.current = resolve
        setConfirmState({
          open: true,
          title: opts.title || t('confirm'),
          body: opts.body || '',
          confirmLabel: opts.confirmLabel,
          danger: opts.danger !== false,
        })
      }),
    [t],
  )

  const closeConfirm = useCallback((result) => {
    setConfirmState({ open: false })
    const resolve = confirmResolver.current
    confirmResolver.current = null
    if (resolve) resolve(result)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={confirm}>
        {children}
        <ToastHost toasts={toasts} dismiss={dismiss} />
        <ConfirmDialog
          state={confirmState}
          onCancel={() => closeConfirm(false)}
          onConfirm={() => closeConfirm(true)}
        />
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (ctx) return ctx
  return { push: () => {}, dismiss: () => {}, success: () => {}, error: () => {}, info: () => {} }
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  return ctx || (() => Promise.resolve(true))
}

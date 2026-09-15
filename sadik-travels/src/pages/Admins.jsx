import { useState } from 'react'
import { backend, useAdmins } from '../store/index.js'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/index.jsx'
import { useFormat } from '../i18n/format.js'
import { Icon } from '../components/Icons.jsx'
import { useToast, useConfirm } from '../components/Feedback.jsx'
import { Skeleton } from '../components/Loading.jsx'

const EMPTY = { email: '', password: '', displayName: '' }

export default function Admins() {
  const { t } = useI18n()
  const { dateTime } = useFormat()
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const { data: admins = [], error, loading } = useAdmins()

  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(EMPTY)
  const [busy, setBusy] = useState(false)

  const [pw, setPw] = useState({ current: '', next: '' })
  const [pwBusy, setPwBusy] = useState(false)

  async function addAdmin(e) {
    e.preventDefault()
    if (!form.email.trim()) {
      toast.error(t('email'))
      return
    }
    if (!form.password || form.password.length < 6) {
      toast.error(t('passwordMin6'))
      return
    }
    setBusy(true)
    try {
      await backend.createAdmin(form)
      setForm(EMPTY)
      toast.success(t('adminAdded'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit() {
    setBusy(true)
    try {
      await backend.updateAdmin(editingId, draft)
      setEditingId(null)
      setDraft(EMPTY)
      toast.success(t('adminUpdated'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeAdmin(a) {
    if (a.id === user.id) {
      toast.error(t('cannotDeleteSelf'))
      return
    }
    const ok = await confirm({
      title: t('adminRemoved'),
      body: t('confirmDeleteAdmin', { email: a.email }),
      confirmLabel: t('confirm'),
    })
    if (!ok) return
    setBusy(true)
    try {
      await backend.deleteAdmin(a.id)
      toast.success(t('adminRemoved'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function sendReset(a) {
    try {
      await backend.sendPasswordReset(a.email)
      toast.success(t('resetSent', { email: a.email }))
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function changePassword(e) {
    e.preventDefault()
    if (!pw.current || pw.next.length < 6) {
      toast.error(t('passwordMin6'))
      return
    }
    setPwBusy(true)
    try {
      await backend.changeMyPassword(user, pw.current, pw.next)
      setPw({ current: '', next: '' })
      toast.success(t('passwordUpdated'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h2>{t('adminsTitle')}</h2>
          <p>{t('adminsSub')}</p>
        </div>
        <span className="pill">{t('total', { count: admins.length })}</span>
      </header>

      {error && (
        <div className="notice error" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      <section className="card">
        <h3 className="card-title">{t('addAdmin')}</h3>
        <form className="form-row" onSubmit={addAdmin}>
          <label className="field grow">
            <span>{t('email')} *</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="field grow">
            <span>{t('displayName')}</span>
            <input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>{t('passwordMin6')} *</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
              minLength={6}
            />
          </label>
          <button type="submit" className="btn primary" disabled={busy}>
            <Icon name="plus" size={16} />
            {t('addAdmin')}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>{t('adminAccounts')}</h3>
          <span className="muted small">{t('passwordNote')}</span>
        </div>

        {loading ? (
          <Skeleton rows={5} />
        ) : admins.length === 0 ? (
          <div className="empty">
            <Icon name="admins" size={26} />
            <p>{t('adminsSub')}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('email')}</th>
                  <th>{t('displayName')}</th>
                  <th>{t('created')}</th>
                  <th>{t('lastSignIn')}</th>
                  <th className="actions-col">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) =>
                  editingId === a.id ? (
                    <tr key={a.id} className="editing-row">
                      <td>
                        <input
                          type="email"
                          value={draft.email}
                          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          value={draft.displayName}
                          onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                        />
                      </td>
                      <td className="muted">—</td>
                      <td className="muted">—</td>
                      <td className="actions-col">
                        <button type="button" className="btn small primary" onClick={saveEdit} disabled={busy}>
                          <Icon name="check" size={14} />
                          {t('save')}
                        </button>
                        <button type="button" className="btn small ghost" onClick={() => setEditingId(null)}>
                          {t('cancel')}
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={a.id}>
                      <td className="strong">
                        {a.email}
                        {a.id === user.id && <span className="badge saved">{t('you')}</span>}
                        {a.role === 'owner' && <span className="badge owner">{t('owner')}</span>}
                      </td>
                      <td>{a.displayName || '—'}</td>
                      <td className="muted">{a.createdAt ? dateTime(a.createdAt) : '—'}</td>
                      <td className="muted">{a.lastLoginAt ? dateTime(a.lastLoginAt) : t('never')}</td>
                      <td className="actions-col">
                        <button
                          type="button"
                          className="icon-btn sm"
                          aria-label={t('edit')}
                          title={t('edit')}
                          onClick={() => {
                            setEditingId(a.id)
                            setDraft({ email: a.email, displayName: a.displayName || '', password: '' })
                          }}
                        >
                          <Icon name="edit" size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn sm"
                          aria-label={t('sendReset')}
                          title={t('sendReset')}
                          onClick={() => sendReset(a)}
                        >
                          <Icon name="mail" size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn sm danger"
                          aria-label={t('delete')}
                          title={t('delete')}
                          onClick={() => removeAdmin(a)}
                          disabled={a.id === user.id}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h3 className="card-title">{t('changeMyPassword')}</h3>
        <p className="muted small">{t('resetNote')}</p>
        <form className="form-row" onSubmit={changePassword}>
          <label className="field">
            <span>{t('currentPassword')}</span>
            <input
              type="password"
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
              autoComplete="current-password"
            />
          </label>
          <label className="field">
            <span>{t('newPassword')}</span>
            <input
              type="password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              autoComplete="new-password"
              minLength={6}
            />
          </label>
          <button type="submit" className="btn primary" disabled={pwBusy}>
            {pwBusy ? (
              <>
                <span className="spinner sm" />
                {t('updating')}
              </>
            ) : (
              <>
                <Icon name="key" size={16} />
                {t('updatePassword')}
              </>
            )}
          </button>
        </form>
      </section>
    </div>
  )
}

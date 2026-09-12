import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAdmins, mutations } from '../store/database'
import { formatDateTime } from '../utils'

const emptyForm = { email: '', password: '', displayName: '' }

export default function Admins() {
  const { user } = useAuth()
  const { data: admins = [], error, loading } = useAdmins()
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [localError, setLocalError] = useState('')

  // Change own password form state.
  const [pwForm, setPwForm] = useState({ current: '', next: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [pwBusy, setPwBusy] = useState(false)

  const clearMsg = () => { setMessage(''); setLocalError('') }

  async function addAdmin(e) {
    e.preventDefault()
    clearMsg()
    if (!form.email.trim()) { setLocalError('Email is required.'); return }
    if (!form.password || form.password.length < 6) { setLocalError('Password must be at least 6 characters.'); return }
    setBusy(true)
    try {
      await mutations.createAdmin(form)
      setForm(emptyForm)
      setMessage('Admin added.')
    } catch (err) { setLocalError(err.message) }
    finally { setBusy(false) }
  }

  function startEdit(a) {
    setEditingId(a.id)
    setEditForm({ email: a.email, displayName: a.displayName || '', password: '' })
    clearMsg()
  }
  function cancelEdit() { setEditingId(null); setEditForm(emptyForm) }

  async function saveEdit() {
    clearMsg()
    setBusy(true)
    try {
      await mutations.updateAdmin(editingId, {
        email: editForm.email.trim(),
        displayName: editForm.displayName,
        password: editForm.password,
      })
      setEditingId(null); setEditForm(emptyForm)
      setMessage('Admin updated.')
    } catch (err) { setLocalError(err.message) }
    finally { setBusy(false) }
  }

  async function removeAdmin(a) {
    if (a.id === user.id) {
      setLocalError('You cannot delete your own account while signed in.')
      return
    }
    const ok = window.confirm(`Remove admin "${a.email}"? They will no longer be able to sign in.`)
    if (!ok) return
    clearMsg()
    setBusy(true)
    try {
      await mutations.deleteAdmin(a.id, user.id)
      setMessage('Admin removed.')
    } catch (err) { setLocalError(err.message) }
    finally { setBusy(false) }
  }

  async function changePassword(e) {
    e.preventDefault()
    setPwMsg(''); setPwErr('')
    if (!pwForm.current || !pwForm.next) { setPwErr('Current and new password are required.'); return }
    if (pwForm.next.length < 6) { setPwErr('New password must be at least 6 characters.'); return }
    setPwBusy(true)
    try {
      await mutations.changePassword(user.id, pwForm.current, pwForm.next)
      setPwMsg('Password updated.')
      setPwForm({ current: '', next: '' })
    } catch (err) { setPwErr(err.message) }
    finally { setPwBusy(false) }
  }

  return (
    <div>
      <div className="page-head">
        <h2>Administrators</h2>
        <p>Manage who can sign in to this dashboard.</p>
      </div>

      {message && <div className="toast success">{message}</div>}
      {(error || localError) && <div className="toast error">{error || localError}</div>}

      <div className="card">
        <h3>Add Admin</h3>
        <form className="form-row" onSubmit={addAdmin}>
          <input
            placeholder="Email *"
            type="email"
            value={form.email}
            className="grow"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            placeholder="Display name (optional)"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
          <input
            placeholder="Password (min 6 chars) *"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Adding…' : '+ Add'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Admin Accounts</h3>
          <span className="pill">{admins.length} total</span>
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : admins.length === 0 ? (
          <p className="muted">No admins found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Display Name</th>
                  <th>Created</th>
                  <th>Last Sign In</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) =>
                  editingId === a.id ? (
                    <tr key={a.id} className="editing-row">
                      <td>
                        <input type="email" value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                      </td>
                      <td>
                        <input value={editForm.displayName}
                          onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                          placeholder="(optional)" />
                      </td>
                      <td>—</td>
                      <td>
                        <input type="password" placeholder="New password (leave blank to keep)"
                          value={editForm.password}
                          onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                      </td>
                      <td className="actions-col">
                        <button className="btn small primary" onClick={saveEdit} disabled={busy}>Save</button>
                        <button className="btn small ghost" onClick={cancelEdit}>Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={a.id}>
                      <td className="strong">
                        {a.email}
                        {a.id === user.id && <span className="badge saved" style={{ marginLeft: 8 }}>You</span>}
                      </td>
                      <td>{a.displayName || '—'}</td>
                      <td className="muted">{formatDateTime(a.createdAt)}</td>
                      <td className="muted">{a.lastLoginAt ? formatDateTime(a.lastLoginAt) : 'Never'}</td>
                      <td className="actions-col">
                        <button className="btn small ghost" onClick={() => startEdit(a)}>Edit</button>
                        <button
                          className="btn small danger"
                          onClick={() => removeAdmin(a)}
                          disabled={a.id === user.id}
                          title={a.id === user.id ? 'You cannot delete your own account' : ''}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Change My Password</h3>
        <form className="form-row" onSubmit={changePassword}>
          <input
            type="password"
            placeholder="Current password"
            value={pwForm.current}
            onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
          />
          <input
            type="password"
            placeholder="New password (min 6 chars)"
            value={pwForm.next}
            onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
          />
          <button type="submit" className="btn primary" disabled={pwBusy}>
            {pwBusy ? 'Updating…' : 'Update password'}
          </button>
        </form>
        {pwMsg && <div className="toast success" style={{ marginTop: 12 }}>{pwMsg}</div>}
        {pwErr && <div className="toast error" style={{ marginTop: 12 }}>{pwErr}</div>}
      </div>
    </div>
  )
}

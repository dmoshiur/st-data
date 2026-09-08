import { useEffect, useState } from 'react'
import {
  db,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from '../store/firestore'

const emptyForm = { name: '', phone: '', note: '' }

export default function Funders() {
  const [funders, setFunders] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'funders'), orderBy('name'))
    const unsub = onSnapshot(
      q,
      (snap) => setFunders(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => setError(e.message),
    )
    return unsub
  }, [])

  const clearMessages = () => {
    setMessage('')
    setError('')
  }

  async function addFunder(e) {
    e.preventDefault()
    clearMessages()
    if (!form.name.trim()) {
      setError('Funder name is required.')
      return
    }
    setBusy(true)
    try {
      await addDoc(collection(db, 'funders'), {
        name: form.name.trim(),
        phone: form.phone.trim(),
        note: form.note.trim(),
        createdAt: serverTimestamp(),
      })
      setForm(emptyForm)
      setMessage('Funder added.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function startEdit(f) {
    setEditingId(f.id)
    setEditForm({ name: f.name || '', phone: f.phone || '', note: f.note || '' })
    clearMessages()
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(emptyForm)
  }

  async function saveEdit() {
    clearMessages()
    if (!editForm.name.trim()) {
      setError('Funder name is required.')
      return
    }
    setBusy(true)
    try {
      await updateDoc(doc(db, 'funders', editingId), {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        note: editForm.note.trim(),
      })
      setEditingId(null)
      setEditForm(emptyForm)
      setMessage('Funder updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteFunder(f) {
    const ok = window.confirm(
      `Delete funder "${f.name}"?\n\nPast donation records will NOT be deleted — only this name is removed from the funders list.`,
    )
    if (!ok) return
    clearMessages()
    try {
      await deleteDoc(doc(db, 'funders', f.id))
      setMessage('Funder deleted.')
    } catch (err) {
      setError(err.message)
    }
  }

  const filtered = funders.filter((f) =>
    (f.name || '').toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <div>
      <div className="page-head">
        <h2>Funders (Donors)</h2>
        <p>Add the names you want to collect donations from every month.</p>
      </div>

      {message && <div className="toast success">{message}</div>}
      {error && <div className="toast error">{error}</div>}

      <div className="card">
        <h3>Add Funder</h3>
        <form className="form-row" onSubmit={addFunder}>
          <input
            className="grow"
            placeholder="Funder name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            placeholder="Note (optional)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Adding…' : '+ Add'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Funders List</h3>
          <span className="pill">{funders.length} total</span>
        </div>

        <input
          className="search"
          placeholder="Search funders…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {filtered.length === 0 ? (
          <p className="muted">No funders found. Add your first funder above.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Note</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) =>
                  editingId === f.id ? (
                    <tr key={f.id} className="editing-row">
                      <td>
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          value={editForm.note}
                          onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                        />
                      </td>
                      <td className="actions-col">
                        <button className="btn small primary" onClick={saveEdit} disabled={busy}>
                          Save
                        </button>
                        <button className="btn small ghost" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={f.id}>
                      <td className="strong">{f.name}</td>
                      <td>{f.phone || '—'}</td>
                      <td className="muted">{f.note || '—'}</td>
                      <td className="actions-col">
                        <button className="btn small ghost" onClick={() => startEdit(f)}>
                          Edit
                        </button>
                        <button className="btn small danger" onClick={() => deleteFunder(f)}>
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
    </div>
  )
}

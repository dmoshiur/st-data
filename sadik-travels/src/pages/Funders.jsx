import { memo, useDeferredValue, useMemo, useState } from 'react'
import { backend, useFunders } from '../store/index.js'
import { useI18n } from '../i18n/index.jsx'
import { Icon } from '../components/Icons.jsx'
import { useToast, useConfirm } from '../components/Feedback.jsx'
import { Skeleton } from '../components/Loading.jsx'

const EMPTY = { name: '', phone: '', note: '' }

const FunderRow = memo(function FunderRow({ funder, editing, draft, onChange, onSave, onCancel, onEdit, onDelete }) {
  const { t } = useI18n()

  if (editing) {
    return (
      <tr className="editing-row">
        <td>
          <input
            value={draft.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder={t('funderName')}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave()
              if (e.key === 'Escape') onCancel()
            }}
          />
        </td>
        <td>
          <input
            value={draft.phone}
            onChange={(e) => onChange('phone', e.target.value)}
            placeholder={t('phone')}
            inputMode="tel"
          />
        </td>
        <td>
          <input
            value={draft.note}
            onChange={(e) => onChange('note', e.target.value)}
            placeholder={t('note')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave()
              if (e.key === 'Escape') onCancel()
            }}
          />
        </td>
        <td className="actions-col">
          <button type="button" className="btn small primary" onClick={onSave}>
            <Icon name="check" size={14} />
            {t('save')}
          </button>
          <button type="button" className="btn small ghost" onClick={onCancel}>
            {t('cancel')}
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="strong">{funder.name}</td>
      <td>{funder.phone || '—'}</td>
      <td className="muted">{funder.note || '—'}</td>
      <td className="actions-col">
        <button type="button" className="icon-btn sm" onClick={onEdit} title={t('edit') || 'Edit'} aria-label="Edit">
          <Icon name="edit" size={15} />
        </button>
        <button
          type="button"
          className="icon-btn sm danger"
          onClick={onDelete}
          aria-label="Delete"
        >
          <Icon name="trash" size={15} />
        </button>
      </td>
    </tr>
  )
})

export default function Funders() {
  const { t } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const { data: funders = [], error, loading } = useFunders()

  const [form, setForm] = useState(EMPTY)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(EMPTY)
  const [busy, setBusy] = useState(false)

  const deferredSearch = useDeferredValue(search)

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    if (!q) return funders
    return funders.filter(
      (f) =>
        (f.name || '').toLowerCase().includes(q) ||
        (f.phone || '').includes(q) ||
        (f.note || '').toLowerCase().includes(q),
    )
  }, [funders, deferredSearch])

  async function addFunder(e) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error(t('funderNameRequired'))
      return
    }
    setBusy(true)
    try {
      await backend.createFunder(form)
      setForm(EMPTY)
      toast.success(t('funderAdded'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  function startEdit(f) {
    setEditingId(f.id)
    setDraft({ name: f.name || '', phone: f.phone || '', note: f.note || '' })
  }

  async function saveEdit() {
    if (!draft.name.trim()) {
      toast.error(t('funderNameRequired'))
      return
    }
    setBusy(true)
    try {
      await backend.updateFunder(editingId, draft)
      setEditingId(null)
      setDraft(EMPTY)
      toast.success(t('funderUpdated'))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeFunder(f) {
    const ok = await confirm({
      title: t('funderDeleted'),
      body: t('confirmDeleteFunder', { name: f.name }),
      confirmLabel: t('delete') || 'Delete',
    })
    if (!ok) return
    try {
      await backend.deleteFunder(f.id)
      toast.success(t('funderDeleted'))
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h2>{t('fundersTitle')}</h2>
          <p>{t('fundersSub')}</p>
        </div>
        <span className="pill">{t('total', { count: funders.length })}</span>
      </header>

      {error && (
        <div className="notice error" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      <section className="card">
        <h3 className="card-title">{t('addFunder')}</h3>
        <form className="form-row" onSubmit={addFunder}>
          <label className="field grow">
            <span>{t('funderName')} *</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('funderName')}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>{t('phone')}</span>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              inputMode="tel"
              autoComplete="off"
            />
          </label>
          <label className="field grow">
            <span>{t('note')}</span>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              autoComplete="off"
            />
          </label>
          <button type="submit" className="btn primary" disabled={busy}>
            <Icon name="plus" size={16} />
            {t('addFunder')}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>{t('fundersList')}</h3>
          <div className="search-box">
            <Icon name="search" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchFunders')}
              aria-label={t('searchFunders')}
            />
            {search && (
              <button type="button" className="affix-btn" onClick={() => setSearch('')} aria-label={t('close')}>
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <Skeleton rows={6} />
        ) : funders.length === 0 ? (
          <div className="empty">
            <Icon name="funders" size={26} />
            <p>{t('noFunders')}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <Icon name="search" size={26} />
            <p>{t('noMatches', { query: search })}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('funderName')}</th>
                  <th>{t('phone')}</th>
                  <th>{t('note')}</th>
                  <th className="actions-col">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <FunderRow
                    key={f.id}
                    funder={f}
                    editing={editingId === f.id}
                    draft={draft}
                    onChange={(key, value) => setDraft((d) => ({ ...d, [key]: value }))}
                    onSave={saveEdit}
                    onCancel={() => setEditingId(null)}
                    onEdit={() => startEdit(f)}
                    onDelete={() => removeFunder(f)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && funders.length > 0 && (
          <footer className="card-foot muted">
            {t('showing', { shown: filtered.length, total: funders.length })}
          </footer>
        )}
      </section>
    </div>
  )
}

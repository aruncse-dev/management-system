import Head from 'next/head'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import {
  ConfirmDialog,
  DataPageHeader,
  FabButton,
  AdminDataListSearch,
  SectionChip,
  LoadingState,
} from '@fintracker-vault/ui'

type SectionRow = {
  id: string
  slug: string
  label: string
  sortOrder: number
}

export default function AdminSectionsPage() {
  const [rows, setRows] = useState<SectionRow[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [savingCreate, setSavingCreate] = useState(false)
  const [createSlug, setCreateSlug] = useState('')
  const [createLabel, setCreateLabel] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editId, setEditId] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editLabel, setEditLabel] = useState('')

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/sections', { credentials: 'same-origin' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Failed to load sections')
      setRows((json.data || []) as SectionRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(
      s =>
        s.label.toLowerCase().includes(term) ||
        s.slug.toLowerCase().includes(term),
    )
  }, [rows, q])

  async function createSection(e: FormEvent) {
    e.preventDefault()
    if (!createSlug.trim() || !createLabel.trim()) {
      setError('Slug and label are required')
      return
    }
    setSavingCreate(true)
    setError('')
    try {
      const res = await fetch('/api/admin/sections', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: createSlug.trim(),
          label: createLabel.trim(),
          sortOrder: rows.length,
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Create failed')
      setCreateOpen(false)
      setCreateSlug('')
      setCreateLabel('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSavingCreate(false)
    }
  }

  async function openEdit(sectionId: string) {
    const section = rows.find(s => s.id === sectionId)
    if (!section) return
    setEditOpen(true)
    setEditId(sectionId)
    setEditSlug(section.slug)
    setEditLabel(section.label)
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editId || !editSlug.trim() || !editLabel.trim()) {
      setError('Slug and label are required')
      return
    }
    setSavingEdit(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/sections/${encodeURIComponent(editId)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: editSlug.trim(),
          label: editLabel.trim(),
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Save failed')
      setEditOpen(false)
      setEditId('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteSection() {
    if (!editId) return
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/sections/${encodeURIComponent(editId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Delete failed')
      setConfirmDeleteOpen(false)
      setEditOpen(false)
      setEditId('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Sections · Admin</title>
      </Head>
      <div className="admin-page">
        <DataPageHeader title="Menu Sections" right={<SectionChip>{rows.length}</SectionChip>} />

        {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}

        <section>
          {rows.length > 5 && (
            <AdminDataListSearch
              itemCount={rows.length}
              value={q}
              onChange={setQ}
              placeholder="Search sections..."
              ariaLabel="Search sections"
            />
          )}

          {loading && <LoadingState variant="page" />}

          {!loading && rows.length === 0 && (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem 0' }}>
              No sections yet.
            </p>
          )}

          {!loading && filtered.length > 0 && (
            <div className="admin-card-list">
              {filtered.map(s => (
                <div key={s.id} className="admin-card-item">
                  <div className="admin-card-item__body">
                    <h3 className="admin-card-item__title">{s.label}</h3>
                    <p className="admin-card-item__meta">Slug: {s.slug}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="admin-btn"
                      onClick={() => void openEdit(s.id)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.85rem',
                        border: 'none',
                        borderRadius: '8px',
                        background: '#1e5cc7',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <FabButton label="Add section" onClick={() => setCreateOpen(true)} />
      </div>

      {/* Create Modal */}
      {createOpen && (
        <div
          className="modal-bg open admin-modal-wrap"
          onClick={() => setCreateOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div className="modal-shell" onClick={e => e.stopPropagation()}>
            <div
              className="modal-hd modal-hd--blue"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                background: '#1e5cc7',
                color: '#fff',
                borderRadius: '8px 8px 0 0',
              }}
            >
              <span className="modal-title">Add Section</span>
              <button
                className="modal-close"
                onClick={() => setCreateOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <form onSubmit={createSection} className="admin-form">
                <label>
                  Slug *
                  <input
                    type="text"
                    value={createSlug}
                    onChange={e => setCreateSlug(e.target.value)}
                    placeholder="e.g., finances"
                    required
                    autoFocus
                  />
                </label>
                <label>
                  Label *
                  <input
                    type="text"
                    value={createLabel}
                    onChange={e => setCreateLabel(e.target.value)}
                    placeholder="e.g., Finances"
                    required
                  />
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => setCreateOpen(false)}
                    style={{
                      background: '#e5e7eb',
                      color: '#0f172a',
                      padding: '0.5rem 1rem',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-btn"
                    disabled={savingCreate}
                    style={{
                      background: '#1e5cc7',
                      color: '#fff',
                      padding: '0.5rem 1rem',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    {savingCreate ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && (
        <div
          className="modal-bg open admin-modal-wrap"
          onClick={() => setEditOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div className="modal-shell" onClick={e => e.stopPropagation()}>
            <div
              className="modal-hd modal-hd--blue"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                background: '#1e5cc7',
                color: '#fff',
                borderRadius: '8px 8px 0 0',
              }}
            >
              <span className="modal-title">Edit Section</span>
              <button
                className="modal-close"
                onClick={() => setEditOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <form onSubmit={saveEdit} className="admin-form">
                <label>
                  Slug
                  <input
                    type="text"
                    value={editSlug}
                    onChange={e => setEditSlug(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Label
                  <input
                    type="text"
                    value={editLabel}
                    onChange={e => setEditLabel(e.target.value)}
                    required
                  />
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="admin-btn-danger"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={deleting || savingEdit}
                    style={{
                      marginRight: 'auto',
                      padding: '0.5rem 1rem',
                      border: 'none',
                      borderRadius: '8px',
                      background: '#b91c1c',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => setEditOpen(false)}
                    disabled={savingEdit}
                    style={{
                      background: '#e5e7eb',
                      color: '#0f172a',
                      padding: '0.5rem 1rem',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-btn"
                    disabled={savingEdit}
                    style={{
                      background: '#1e5cc7',
                      color: '#fff',
                      padding: '0.5rem 1rem',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    {savingEdit ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete section?"
        description="This will remove the section. Menus in this section may become unorganized."
        confirmText="Delete"
        tone="danger"
        busy={deleting}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => void deleteSection()}
      />
    </>
  )
}

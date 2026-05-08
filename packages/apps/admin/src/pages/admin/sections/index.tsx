import Head from 'next/head'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Search } from 'lucide-react'
import { LoadingState, ModalShell, ModalActions, SearchField, SectionChip } from '@fintracker-vault/ui'

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

  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({ slug: '', label: '' })
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

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
    return rows.filter(s => s.label.toLowerCase().includes(term) || s.slug.toLowerCase().includes(term))
  }, [rows, q])

  function startAdd() {
    setMode('add')
    setEditingId('')
    setForm({ slug: '', label: '' })
    setDeleteConfirm(false)
  }

  function startEdit(row: SectionRow) {
    setMode('edit')
    setEditingId(row.id)
    setForm({ slug: row.slug, label: row.label })
    setDeleteConfirm(false)
  }

  function closeForm() {
    setMode(null)
    setEditingId('')
    setForm({ slug: '', label: '' })
    setDeleteConfirm(false)
  }

  async function save() {
    if (!form.slug.trim() || !form.label.trim()) {
      setError('Slug and label are required')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (mode === 'add') {
        const res = await fetch('/api/admin/sections', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: form.slug.trim(),
            label: form.label.trim(),
            sortOrder: rows.length,
          }),
        })
        const json = await res.json()
        if (!json.ok) throw new Error(json.error || 'Create failed')
      } else if (mode === 'edit') {
        const res = await fetch(`/api/admin/sections/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: form.slug.trim(),
            label: form.label.trim(),
          }),
        })
        const json = await res.json()
        if (!json.ok) throw new Error(json.error || 'Save failed')
      }

      await load()
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    void deleteSection()
  }

  async function deleteSection() {
    if (!editingId) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/sections/${encodeURIComponent(editingId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Delete failed')
      await load()
      closeForm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Head>
        <title>Sections · Admin</title>
      </Head>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ padding: '1.5rem 1rem', background: 'var(--admin-bg, #f0f5ff)', borderBottom: '1px solid var(--admin-border, #e5e7eb)' }}>
          <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Menu Sections</h1>
                <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
                  Organize menu items into sections
                </p>
              </div>
              <SectionChip>{rows.length}</SectionChip>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '1.5rem 1rem' }}>
          <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
            {error && <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.9rem' }}>⚠ {error}</p>}

            {loading && <LoadingState variant="page" />}

            {!loading && rows.length === 0 && (
              <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>
                <p>No sections yet. Create one with the button below.</p>
              </div>
            )}

            {!loading && rows.length > 0 && (
              <>
                {rows.length > 5 && (
                  <SearchField
                    value={q}
                    placeholder="Search sections..."
                    onChange={setQ}
                    onClear={() => setQ('')}
                    prefix={<Search size={15} />}
                  />
                )}

                <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
                  {filtered.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => startEdit(s)}
                      style={{
                        padding: '1rem',
                        border: '1px solid var(--admin-border, #e5e7eb)',
                        borderLeft: '5px solid var(--navy, #1e5cc7)',
                        borderRadius: '8px',
                        background: 'var(--admin-card, #fff)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'box-shadow 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 1px 6px rgba(62, 113, 202, 0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.25rem' }}>
                        {s.label}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                        Slug: {s.slug}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={startAdd}
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            width: '56px',
            height: '56px',
            borderRadius: '999px',
            background: '#1e5cc7',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 16px 32px rgba(30, 92, 199, 0.24)',
            fontSize: '1.25rem',
            fontWeight: 700,
          }}
          title="Add section"
        >
          <Plus size={24} />
        </button>

        {mode && (
          <ModalShell
            title={mode === 'add' ? 'Add Section' : 'Edit Section'}
            onClose={closeForm}
            footer={
              <ModalActions
                secondaryLabel="Cancel"
                primaryLabel={mode === 'add' ? 'Add' : 'Save'}
                onSecondary={closeForm}
                onPrimary={save}
                leading={
                  mode === 'edit' ? (
                    <button
                      type="button"
                      className="ui-kit-btn ui-kit-btn--solid btn-red"
                      onClick={confirmDelete}
                      disabled={saving}
                      style={{
                        background: '#b91c1c',
                        color: '#fff',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                      }}
                    >
                      {saving ? 'Deleting…' : deleteConfirm ? 'Confirm delete?' : 'Delete'}
                    </button>
                  ) : null
                }
                disabled={saving}
              />
            }
          >
            <form onSubmit={(e: FormEvent) => { e.preventDefault(); void save() }} style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' }}>
                  Slug *
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder="e.g., finances"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #ccc',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: '#0f172a' }}>
                  Label *
                </label>
                <input
                  type="text"
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g., Finances"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #ccc',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </form>
          </ModalShell>
        )}
      </div>
    </>
  )
}

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Transaction, TransactionForm } from '@fintracker-vault/types'
import { CATEGORIES, INCOME_CATS } from '@fintracker-vault/config'
import { CategoryCombobox } from './CategoryCombobox'
import { RefCombobox } from './RefCombobox'

const ALL_CATS = [...CATEGORIES, ...INCOME_CATS]

/**
 * A module row a transaction can be linked to.
 *
 * Selecting one stores `ref_kind`/`ref_id` on the transaction and the server
 * mirrors the entry into that module's own ledger, so a loan repayment is typed
 * once instead of twice. The reference is soft: if the target is later deleted
 * the transaction survives with a link that no longer resolves.
 */
export type TransactionRefOption = {
  /** Stored in `ref_kind` — e.g. `emi_loan`, `jewel_loan`, `cash_loan`. */
  kind: string
  /** Stored in `ref_id` — the target row's own id. */
  id: string
  label: string
  /** Heading this option is grouped under in the dropdown. */
  group: string
  /** Transaction types this target accepts. Omitted means any type. */
  types?: readonly string[]
  /** Pre-fills the amount when it is still empty (fixed EMIs). */
  amount?: number
}

export type TransactionModalApi = {
  addRow: (p: Record<string, unknown>) => Promise<unknown>
  updateRow: (p: Record<string, unknown>) => Promise<unknown>
  deleteRow: (month: string, year: string, id: string) => Promise<unknown>
}

interface Props {
  row: Transaction | null
  month: string
  year: string
  onClose: () => void
  onSaved: () => void
  showStatus: (msg: string) => void
  api: TransactionModalApi
  /** Accounts + credit sources allowed as transaction `mode` (payment source). */
  paymentModeOptions: readonly string[]
  /** Accounts + credits allowed as transfer destination (same as payment sources for symmetry). */
  transferTargetOptions: readonly string[]
  /** Expense categories (e.g. `CATEGORIES` ∪ budget names). Defaults to `CATEGORIES` from config. */
  expenseCategoryOptions?: readonly string[]
  /** Income categories (e.g. `ALL_CATS` ∪ budget names). Defaults to merged config lists. */
  incomeCategoryOptions?: readonly string[]
  /** Amount field label (include currency when helpful). */
  amountLabel?: string
  /** Amount input placeholder (e.g. formatted zero in display currency). */
  amountPlaceholder?: string
  /** Module rows this transaction can be linked to. Empty hides the field entirely. */
  refOptions?: readonly TransactionRefOption[]
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function gasDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d}-${months[parseInt(m, 10) - 1]}-${y.slice(2)}`
}

function isoFromGas(s: string) {
  if (!s) return todayISO()
  const months: Record<string, string> = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
  }
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/)
  if (!m) return todayISO()
  return `20${m[3]}-${months[m[2]]}-${m[1].padStart(2, '0')}`
}


function buildTransactionFormFromRow(
  row: Transaction | null,
  paymentModeOptions: readonly string[],
  transferTargetOptions: readonly string[],
): TransactionForm {
  const defaultMode = paymentModeOptions[0] ?? 'Cash'
  const defaultTo = transferTargetOptions[0] ?? paymentModeOptions[0] ?? 'Cash'
  if (!row) {
    return {
      date: todayISO(),
      desc: '',
      a: '',
      c: 'Groceries',
      t: 'Expense',
      m: defaultMode,
      notes: '',
      toAcct: defaultTo,
      ref: '',
    }
  }
  let notes = row.notes || ''
  let toAcct = defaultTo
  if (row.t === 'Transfer') {
    const col = (row.transferTo ?? '').trim()
    if (col) {
      toAcct = col
      notes = (row.notes ?? '').trim()
    } else {
      const trimmed = notes.trim()
      const m = trimmed.match(/^(?:→|->)\s*(.+?)(?:\s*·\s*([\s\S]*))?$/)
      if (m) {
        toAcct = m[1].trim() || defaultTo
        notes = (m[2] || '').trim()
      }
    }
  }
  return {
    date: isoFromGas(row.date),
    desc: row.desc || '',
    a: String(row.a),
    c: row.c || 'Groceries',
    t: row.t || 'Expense',
    m: row.m || defaultMode,
    notes,
    toAcct,
    ref: row.refKind && row.refId ? `${row.refKind}:${row.refId}` : '',
  }
}

export default function TransactionModal({
  row,
  month,
  year,
  onClose,
  onSaved,
  showStatus,
  api,
  paymentModeOptions,
  transferTargetOptions,
  expenseCategoryOptions,
  incomeCategoryOptions,
  amountLabel = 'Amount',
  amountPlaceholder = '0',
  refOptions = [],
}: Props) {
  const isEdit = Boolean(row?.id)
  const defaultMode = paymentModeOptions[0] ?? 'Cash'
  const defaultTo = transferTargetOptions[0] ?? paymentModeOptions[0] ?? 'Cash'
  const [form, setForm] = useState<TransactionForm>(() =>
    buildTransactionFormFromRow(row, paymentModeOptions, transferTargetOptions),
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)

  const isTransfer = form.t === 'Transfer'
  // A target only offers itself for the types it can represent — a loan
  // repayment is an expense, so the field disappears on Income entirely.
  const linkable = refOptions.filter(o => !o.types || o.types.includes(form.t))
  const selectedRef = linkable.find(o => `${o.kind}:${o.id}` === form.ref) ?? null
  // An edit whose target no longer resolves keeps its ref rather than silently
  // dropping it — clearing the field would quietly unlink the module row.
  const staleRef = form.ref && !selectedRef ? form.ref : ''
  const cats: readonly string[] =
    form.t === 'Income'
      ? (incomeCategoryOptions ?? ALL_CATS)
      : (expenseCategoryOptions ?? CATEGORIES)

  function set(k: keyof TransactionForm, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  /**
   * Picking a link fills the amount and description when they are still blank.
   * EMIs have no part payment, so their amount is known the moment the loan is
   * chosen; anything already typed is left alone.
   */
  function setRef(v: string) {
    const opt = refOptions.find(o => `${o.kind}:${o.id}` === v)
    setForm(f => ({
      ...f,
      ref: v,
      a: !f.a && opt?.amount ? String(opt.amount) : f.a,
      desc: !f.desc.trim() && opt ? opt.label : f.desc,
    }))
  }

  /**
   * Changing the type can invalidate the link (an expense-only loan on an
   * Income row), so drop it rather than saving a mirror that can never exist.
   */
  function setType(v: string) {
    setForm(f => {
      const opt = refOptions.find(o => `${o.kind}:${o.id}` === f.ref)
      const keep = !opt || !opt.types || opt.types.includes(v)
      return { ...f, t: v, ref: keep ? f.ref : '' }
    })
  }

  async function save() {
    if (!form.desc.trim() || !form.a) {
      showStatus('⚠ Fill all fields')
      return
    }
    setSaving(true)
    const extra = form.notes.trim()
    const notes = isTransfer ? extra : form.notes
    const transferTo = isTransfer ? (form.toAcct || '').trim() : ''
    const [refKind, refId] = (form.ref || '').split(':')
    const p = {
      month,
      year,
      date: gasDate(form.date),
      desc: form.desc.trim(),
      a: parseFloat(form.a),
      c: isTransfer ? 'Transfer' : form.c,
      t: form.t,
      m: form.m,
      notes,
      ...(isTransfer ? { transferTo } : {}),
      // Always sent, so clearing the dropdown actually unlinks on save.
      refKind: refKind && refId ? refKind : '',
      refId: refKind && refId ? refId : '',
    }
    try {
      if (isEdit && row?.id) await api.updateRow({ ...p, id: row.id })
      else await api.addRow(p)
      onSaved()
    } catch (e) {
      showStatus('⚠ ' + (e instanceof Error ? e.message : 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  async function del() {
    if (!delConfirm) {
      setDelConfirm(true)
      return
    }
    if (!row) return
    setDeleting(true)
    try {
      await api.deleteRow(month, year, row.id)
      onSaved()
    } catch (e) {
      showStatus('⚠ ' + (e instanceof Error ? e.message : 'Delete failed'))
      setDeleting(false)
    }
  }

  return (
    <div
      className="modal-bg open"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-hd modal-hd--blue">
          <span className="modal-title">{isEdit ? 'Edit Transaction' : 'Add Transaction'}</span>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body transaction-modal-body">
          <div className="form-row">
            <label className="form-lbl">Date</label>
            <input className="form-inp" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-lbl">{amountLabel}</label>
            <input
              className="form-inp"
              type="number"
              min="0"
              step="1"
              placeholder={amountPlaceholder}
              value={form.a}
              onChange={e => set('a', e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-lbl">Description</label>
            <input
              className="form-inp"
              type="text"
              placeholder="What was this for?"
              value={form.desc}
              onChange={e => set('desc', e.target.value)}
            />
          </div>
          <div className="form-row">
            <label className="form-lbl">Type</label>
            <select className="form-sel" value={form.t} onChange={e => setType(e.target.value)}>
              <option>Expense</option>
              <option>Income</option>
              <option>Transfer</option>
            </select>
          </div>
          {!isTransfer && (
            <div className="form-row">
              <label className="form-lbl">Category</label>
              <CategoryCombobox value={form.c} options={cats} onChange={v => set('c', v)} />
            </div>
          )}
          <div className="form-row">
            <label className="form-lbl">Mode / Account</label>
            <select className="form-sel" value={form.m} onChange={e => set('m', e.target.value)}>
              {form.m && !paymentModeOptions.includes(form.m) ? (
                <option value={form.m}>{form.m} (legacy)</option>
              ) : null}
              {paymentModeOptions.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {linkable.length > 0 && (
            <div className="form-row">
              <label className="form-lbl">Link to</label>
              <RefCombobox
                value={form.ref ?? ''}
                options={linkable}
                onChange={setRef}
                staleRef={staleRef}
              />
            </div>
          )}
          {isTransfer && (
            <div className="form-row">
              <label className="form-lbl">Transfer To</label>
              <select className="form-sel" value={form.toAcct} onChange={e => set('toAcct', e.target.value)}>
                {form.toAcct && !transferTargetOptions.includes(form.toAcct) ? (
                  <option value={form.toAcct}>{form.toAcct} (legacy)</option>
                ) : null}
                {transferTargetOptions.map(a => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-row">
            <label className="form-lbl">{isTransfer ? 'Memo (optional)' : 'Notes'}</label>
            <input
              className="form-inp"
              type="text"
              placeholder={isTransfer ? 'Shown after · in stored notes' : 'Optional notes'}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>
        </div>
        <div className="modal-foot">
          <div className="modal-foot-l">
            {isEdit && (
              <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={del} disabled={deleting}>
                {deleting ? 'Deleting…' : delConfirm ? 'Confirm delete?' : 'Delete'}
              </button>
            )}
          </div>
          <button type="button" className="ui-kit-btn ui-kit-btn--soft ui-kit-btn--cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ui-kit-btn ui-kit-btn--solid" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

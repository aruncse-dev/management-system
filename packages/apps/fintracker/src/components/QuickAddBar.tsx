import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Zap } from 'lucide-react'
import { parseQuickAdd, quickAddSummary } from '@fintracker-vault/utils'
import { api } from '../api'
import { gasDate } from '../utils'
import type { Transaction } from '../types'

/**
 * One-line spend entry, docked at the bottom of every tab.
 *
 *     500 Vegetables Cash
 *     100 Auto Travel Cash
 *     100 Temple VIsit Travel HDFC Bank
 *
 * Floating rather than sitting on the register, because adding a spend is not
 * something you go to a screen to do — it happens while you are looking at the
 * dashboard, or at nothing. The plus button opens this instead of the form: the
 * overwhelming majority of entries are four fields in one line, and a modal for
 * that is a screen and a tap spent on nothing.
 *
 * Saves directly. The parsed split sits under the box, so what will be written
 * is visible before Enter, and the form is always one tap away for anything the
 * line cannot express — a transfer, a link, a note.
 */
export function QuickAddBar({
  month,
  year,
  categories,
  incomeCategories,
  modes,
  onSaved,
  onExpand,
  onClose,
  showStatus,
}: {
  month: string
  year: string
  /** Live expense categories, budget names included. */
  categories: readonly string[]
  incomeCategories: readonly string[]
  /** Live payment sources. */
  modes: readonly string[]
  onSaved: (savedDate: string) => void | Promise<void>
  /** Hand off to the full form, prefilled with whatever parsed. */
  onExpand: (draft: Transaction) => void
  onClose: () => void
  showStatus: (msg: string) => void
}) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const lists = useMemo(
    () => ({
      // Both lists at once, so "Salary" is recognised while the default type is
      // still Expense — matching it is what flips the row to Income.
      categories: [...new Set([...categories, ...incomeCategories])],
      modes,
      incomeCategories,
    }),
    [categories, incomeCategories, modes],
  )

  const parsed = useMemo(
    () => (text.trim() ? parseQuickAdd(text, lists) : null),
    [text, lists],
  )

  /**
   * What is still missing, named. An amount and a category are the two the
   * register cannot do without — a blank category makes the row invisible to
   * every budget and breakdown on the dashboard, which is worse than never
   * having saved it.
   */
  const missing = !parsed
    ? []
    : [!parsed.amount ? 'an amount' : null, !parsed.category ? 'a category' : null].filter(Boolean)

  const ready = Boolean(parsed?.matched) && missing.length === 0

  function draft(): Transaction {
    return {
      id: '',
      date: gasDate(parsed?.date ?? todayIso()),
      desc: parsed?.desc ?? '',
      a: Number(parsed?.amount ?? 0),
      c: parsed?.category ?? '',
      t: parsed?.type ?? 'Expense',
      m: parsed?.mode ?? modes[0] ?? '',
      notes: '',
    }
  }

  async function save() {
    if (!parsed || !ready) return
    setSaving(true)
    const date = gasDate(parsed.date ?? todayIso())
    try {
      await api.addRow({
        month,
        year,
        date,
        desc: (parsed.desc ?? parsed.category ?? '').trim(),
        a: Number(parsed.amount),
        c: parsed.category,
        t: parsed.type,
        // The form's own fallback: the first configured source.
        m: parsed.mode ?? modes[0] ?? '',
        notes: '',
      })
      // Cleared but left open: catching up on a few days is type, Enter, type,
      // Enter, and reopening the dock between each would be the whole cost of
      // the feature back again.
      setText('')
      await onSaved(date)
      inputRef.current?.focus()
    } catch (e) {
      showStatus('⚠ ' + (e instanceof Error ? e.message : 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="quickadd" role="dialog" aria-label="Quick add a transaction">
      <div className="quickadd-field">
        <Zap size={15} className="quickadd-icon" />
        <input
          ref={inputRef}
          className="form-inp"
          type="text"
          autoComplete="off"
          aria-label="Quick add a transaction"
          placeholder="500 Vegetables Cash"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (ready) void save()
              else onExpand(draft())
            } else if (e.key === 'Escape') {
              e.preventDefault()
              if (text) setText('')
              else onClose()
            }
          }}
        />
        <button type="button" className="quickadd-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="quickadd-foot">
        {parsed?.matched ? (
          <span className="quickadd-preview">
            <span className="quickadd-split">{quickAddSummary(parsed, '')}</span>
            {missing.length > 0 ? (
              <span className="quickadd-missing">needs {missing.join(' and ')}</span>
            ) : null}
          </span>
        ) : (
          <span className="quickadd-hint">amount · what it was · category · account</span>
        )}

        <span className="quickadd-actions">
          {/* Always reachable, empty box included — this is how you get to a
              transfer, a linked premium, or anything with a note on it. */}
          <button type="button" className="btn btn-sm btn-cancel" onClick={() => onExpand(draft())}>
            Form
          </button>
          <button
            type="button"
            className="btn btn-sm quickadd-go"
            onClick={() => void save()}
            disabled={!ready || saving}
          >
            {saving ? '…' : 'Add'}
          </button>
        </span>
      </div>
    </div>
  )
}

/** Local time. `toISOString()` is UTC and reads as yesterday until 05:30 IST. */
function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

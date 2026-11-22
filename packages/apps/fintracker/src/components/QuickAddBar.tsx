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
 * Saves optimistically: Enter clears the box and the row shows in the list at
 * once, while the save runs behind it. Several entries can be in flight; one
 * that fails comes back into the box with the error, so nothing is lost.
 *
 * The parsed split sits under the box, so what will be written
 * is visible before Enter, and the form is always one tap away for anything the
 * line cannot express — a transfer, a link, a note.
 */
export function QuickAddBar({
  month,
  year,
  categories,
  incomeCategories,
  modes,
  onSubmit,
  onExpand,
  onClose,
  showStatus,
  initialText = '',
}: {
  month: string
  year: string
  /** Live expense categories, budget names included. */
  categories: readonly string[]
  incomeCategories: readonly string[]
  /** Live payment sources. */
  modes: readonly string[]
  /**
   * Persist one entry. Called with the payload for `api.addRow` and the row as
   * it should appear in the list; resolves once the server has it.
   */
  onSubmit: (payload: Record<string, unknown>, row: Transaction) => Promise<void>
  /** Hand off to the full form, prefilled with whatever parsed. */
  onExpand: (draft: Transaction) => void
  onClose: () => void
  showStatus: (msg: string) => void
  /** Prefilled line, e.g. from a DayNest reminder link (`?quick=1&q=…`). Never saved without Enter. */
  initialText?: string
}) {
  const [text, setText] = useState(initialText)
  /** Entries sent but not yet confirmed — typing the next one never waits on them. */
  const [pending, setPending] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const lists = useMemo(() => {
    // `incomeCategories` is everything an Income row may be filed under, which
    // includes every expense category too. Only the names that are income and
    // nothing else may flip the row — otherwise "500 Vegetables Cash" saves as
    // Income, as it did. Expense is the default; "Salary" is what changes it.
    const expense = new Set(categories.map(c => c.trim().toLowerCase()))
    return {
      categories: [...new Set([...categories, ...incomeCategories])],
      modes,
      incomeCategories: incomeCategories.filter(c => !expense.has(c.trim().toLowerCase())),
    }
  }, [categories, incomeCategories, modes])

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

  function save() {
    if (!parsed || !ready) return
    const date = gasDate(parsed.date ?? todayIso())
    const payload = {
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
    }
    const row: Transaction = {
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date,
      desc: payload.desc,
      a: payload.a,
      c: String(payload.c ?? ''),
      t: (payload.t ?? 'Expense') as Transaction['t'],
      m: payload.m,
      notes: '',
    }
    const sentText = text
    // Cleared and left open at once: catching up on a few days is type, Enter,
    // type, Enter — waiting on the network between each was the whole cost.
    setText('')
    inputRef.current?.focus()
    setPending(n => n + 1)
    void onSubmit(payload, row)
      .catch(e => {
        // Put it back only if the box is still empty, so it never clobbers
        // whatever is being typed now.
        setText(cur => (cur ? cur : sentText))
        showStatus('⚠ ' + (e instanceof Error ? e.message : 'Save failed') + ' — entry kept in the box')
      })
      .finally(() => setPending(n => n - 1))
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
              if (ready) save()
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
            onClick={save}
            disabled={!ready}
          >
            {pending > 0 ? `Add · ${pending}…` : 'Add'}
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

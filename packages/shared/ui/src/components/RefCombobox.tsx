import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { TransactionRefOption } from './TransactionModal'

/** `kind:id` — how a link is stored in the form and split apart on save. */
function keyOf(o: TransactionRefOption): string {
  return `${o.kind}:${o.id}`
}

/**
 * Picker for the module row a transaction links to.
 *
 * Deliberately the same shape as `CategoryCombobox` — type to filter, arrow
 * keys, Enter to commit — because it sits two fields below it in the same form
 * and a plain `<select>` there behaved differently for no reason the user could
 * see. What it adds is the option's *type*: "Fuel" means nothing until you can
 * see it is a Jewel loan rather than a subscription, and several modules can
 * hold rows with the same name.
 */
export function RefCombobox({
  value,
  options,
  onChange,
  staleRef,
}: {
  /** `kind:id`, or `''` for unlinked. */
  value: string
  options: readonly TransactionRefOption[]
  onChange: (v: string) => void
  /** Set when the saved target no longer resolves; shown so an edit cannot silently drop it. */
  staleRef?: string
}) {
  const comboboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const [focused, setFocused] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const selected = useMemo(
    () => options.find(o => keyOf(o) === value) ?? null,
    [options, value],
  )

  /** Grouped by type, then alphabetical, so the list reads as the modules it spans. */
  const sorted = useMemo(
    () =>
      [...options].sort(
        (a, b) =>
          a.group.localeCompare(b.group, undefined, { sensitivity: 'base' }) ||
          a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
      ),
    [options],
  )

  // The type is searchable too — "loan" should find every loan without the user
  // knowing which of the three kinds a row happens to be.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(
      o => o.label.toLowerCase().includes(q) || o.group.toLowerCase().includes(q),
    )
  }, [sorted, query])

  useEffect(() => {
    setHighlight(h => (filtered.length === 0 ? 0 : Math.min(h, filtered.length - 1)))
  }, [filtered])

  useEffect(() => {
    if (!focused || filtered.length === 0) return
    listRef.current?.querySelector(`[data-ref-i="${highlight}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [highlight, focused, filtered])

  useEffect(() => {
    if (!focused) return
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setFocused(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [focused])

  function commit(next: string) {
    onChange(next)
    setQuery('')
    setFocused(false)
    setHighlight(0)
    inputRef.current?.blur()
  }

  const displayValue = selected ? selected.label : staleRef ? 'Link unavailable' : ''
  const inputValue = focused ? query : displayValue
  const showList = focused

  return (
    <div ref={rootRef} className="ui-kit-ref-combo">
      <div className="ui-kit-ref-combo-field">
        <input
          ref={inputRef}
          id={comboboxId}
          className="form-inp"
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? `${comboboxId}-listbox` : undefined}
          aria-autocomplete="list"
          aria-label="Link to"
          placeholder={focused ? 'Type to filter…' : 'Tap to search loans, lending, savings…'}
          value={inputValue}
          onFocus={() => { setFocused(true); setQuery(''); setHighlight(0) }}
          onChange={e => { setQuery(e.target.value); setHighlight(0) }}
          onKeyDown={e => {
            if (!focused) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHighlight(h => Math.min(h + 1, Math.max(0, filtered.length - 1)))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlight(h => Math.max(h - 1, 0))
            } else if (e.key === 'Enter') {
              const pick = filtered[highlight]
              if (pick) { e.preventDefault(); commit(keyOf(pick)) }
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setFocused(false)
              setQuery('')
              inputRef.current?.blur()
            }
          }}
        />
      </div>

      {/* The selected link's type, stated rather than implied by the name. */}
      {selected && !focused ? (
        <div className="ui-kit-ref-selected">
          <span className="ui-kit-ref-kind">{selected.group}</span>
          <button type="button" className="ui-kit-ref-clear" onClick={() => commit('')}>
            Remove link
          </button>
        </div>
      ) : null}

      {showList && (
        <div
          ref={listRef}
          id={`${comboboxId}-listbox`}
          role="listbox"
          className="ui-kit-ref-list"
        >
          <button
            type="button"
            role="option"
            aria-selected={value === ''}
            className="ui-kit-ref-opt"
            onMouseDown={e => { e.preventDefault(); commit('') }}
          >
            <span className="ui-kit-ref-opt-label">Not linked</span>
          </button>
          {filtered.length === 0 ? (
            <div className="ui-kit-ref-empty">No matches</div>
          ) : (
            filtered.map((o, i) => {
              const k = keyOf(o)
              return (
                <button
                  key={k}
                  type="button"
                  role="option"
                  aria-selected={i === highlight || k === value}
                  data-ref-i={i}
                  className={`ui-kit-ref-opt${i === highlight ? ' is-active' : ''}${k === value ? ' is-selected' : ''}`}
                  onMouseDown={e => { e.preventDefault(); commit(k) }}
                >
                  <span className="ui-kit-ref-opt-label">{o.label}</span>
                  <span className="ui-kit-ref-kind">{o.group}</span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

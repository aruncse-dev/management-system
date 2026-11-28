import { useEffect, useId, useMemo, useRef, useState } from 'react'

/**
 * Picker for a closed list of strings — type to filter, arrow keys, Enter to
 * commit.
 *
 * Was `CategoryCombobox`, and category is still what it mostly picks, but the
 * payment mode and the transfer target were plain `<select>`s sitting in the
 * same form. On a phone that is two different interactions for the same job:
 * one you scan and type, one that opens the OS wheel. Same control for both.
 *
 * Only a listed option can be committed. Typing something unrecognised and
 * leaving restores the current value rather than saving the text, which is what
 * keeps the account name spellable in one way only.
 */
export function OptionCombobox({
  value,
  options,
  onChange,
  ariaLabel = 'Category',
  placeholder = 'Tap to search categories',
  order = 'alpha',
  allowNew = false,
  newLabel = (name: string) => `Add "${name}"`,
}: {
  value: string
  options: readonly string[]
  onChange: (v: string) => void
  ariaLabel?: string
  placeholder?: string
  /**
   * `given` keeps the caller's order. Accounts arrive sorted by `sort_order`,
   * which groups the banks above the credit cards — alphabetising that list
   * would shuffle the grouping away for no gain.
   */
  order?: 'alpha' | 'given'
  /**
   * Accept a value that is not in the list. Matches are still offered first
   * (case-insensitively, so "arun" picks the existing "Arun" instead of making
   * a second one), then an "Add …" row for the typed text. Typing a name and
   * moving on to the next field keeps it.
   */
  allowNew?: boolean
  newLabel?: (typed: string) => string
}) {
  const comboboxId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const [focused, setFocused] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const sorted = useMemo(() => {
    const uniq = new Set(options.map(String))
    // A value the list no longer offers is kept rather than dropped: editing an
    // old row must not silently retype its account as the first one available.
    if (value && !uniq.has(value)) uniq.add(value)
    const list = [...uniq]
    return order === 'given'
      ? list
      : list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [options, value, order])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(c => c.toLowerCase().includes(q))
  }, [sorted, query])

  /** The typed text, tidied, when it is not already one of the options. */
  const typedNew = useMemo(() => {
    if (!allowNew) return ''
    const t = query.trim().replace(/\s+/g, ' ')
    if (!t) return ''
    return sorted.some(c => c.toLowerCase() === t.toLowerCase()) ? '' : t
  }, [allowNew, query, sorted])

  /** What the list shows: matches first, then "Add …" for a new value. */
  const rows = useMemo(
    () => [...filtered.map(c => ({ value: c, isNew: false })), ...(typedNew ? [{ value: typedNew, isNew: true }] : [])],
    [filtered, typedNew],
  )

  /** Exact (case-insensitive) match for the typed text, else the typed text when new values are allowed. */
  function typedValue(): string {
    const t = query.trim().replace(/\s+/g, ' ')
    if (!t) return ''
    const existing = sorted.find(c => c.toLowerCase() === t.toLowerCase())
    if (existing) return existing
    return allowNew ? t : ''
  }

  useEffect(() => {
    setHighlight(h => (rows.length === 0 ? 0 : Math.min(h, rows.length - 1)))
  }, [rows])

  useEffect(() => {
    if (!focused || rows.length === 0) return
    listRef.current?.querySelector(`[data-cat-i="${highlight}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [highlight, focused, rows])

  useEffect(() => {
    if (!focused) return
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        // Moving on after typing a name keeps it (only when new values are allowed).
        const v = allowNew ? typedValue() : ''
        if (v && v !== value) onChange(v)
        setFocused(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
    // typedValue reads query/sorted/allowNew; re-subscribe when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, query, sorted, allowNew, value, onChange])

  function commit(cat: string) {
    onChange(cat)
    setQuery('')
    setFocused(false)
    setHighlight(0)
    inputRef.current?.blur()
  }

  const inputValue = focused ? query : value
  const showList = focused && (rows.length > 0 || query.trim().length > 0)

  return (
    <div ref={rootRef}>
      <input
        ref={inputRef}
        id={comboboxId}
        className="form-inp"
        type="text"
        autoComplete="off"
        aria-expanded={showList}
        aria-controls={showList ? `${comboboxId}-listbox` : undefined}
        aria-autocomplete="list"
        role="combobox"
        aria-label={ariaLabel}
        placeholder={focused ? 'Type to filter…' : placeholder}
        value={inputValue}
        onFocus={() => { setFocused(true); setQuery(''); setHighlight(0) }}
        onChange={e => { setQuery(e.target.value); setHighlight(0) }}
        onKeyDown={e => {
          if (!focused) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlight(h => Math.min(h + 1, Math.max(0, rows.length - 1)))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight(h => Math.max(h - 1, 0))
          } else if (e.key === 'Enter') {
            const pick = rows[highlight]
            if (pick) { e.preventDefault(); commit(pick.value) }
          } else if (e.key === 'Escape') {
            e.preventDefault()
            setFocused(false)
            setQuery('')
            inputRef.current?.blur()
          }
        }}
      />
      {showList && (
        <div
          ref={listRef}
          id={`${comboboxId}-listbox`}
          role="listbox"
          style={{
            marginTop: 8,
            maxHeight: 'min(40vh, 220px)',
            overflowY: 'auto',
            borderRadius: 'var(--r)',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
          }}
        >
          {rows.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--muted)' }}>No matches</div>
          ) : (
            rows.map(({ value: c, isNew }, i) => (
              <button
                key={(isNew ? 'new:' : '') + c}
                type="button"
                role="option"
                aria-selected={(focused && i === highlight) || (!focused && c === value)}
                data-cat-i={i}
                onMouseDown={e => { e.preventDefault(); commit(c) }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  fontSize: 14,
                  border: 'none',
                  borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : undefined,
                  background: i === highlight ? 'var(--navy-lt)' : c === value ? 'rgba(var(--accent-rgb), 0.08)' : 'transparent',
                  color: isNew ? 'var(--navy)' : 'var(--text)',
                  fontWeight: isNew ? 550 : undefined,
                  cursor: 'pointer',
                }}
              >
                {isNew ? `+ ${newLabel(c)}` : c}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

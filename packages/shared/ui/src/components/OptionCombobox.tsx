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

  useEffect(() => {
    setHighlight(h => (filtered.length === 0 ? 0 : Math.min(h, filtered.length - 1)))
  }, [filtered])

  useEffect(() => {
    if (!focused || filtered.length === 0) return
    listRef.current?.querySelector(`[data-cat-i="${highlight}"]`)?.scrollIntoView({ block: 'nearest' })
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

  function commit(cat: string) {
    onChange(cat)
    setQuery('')
    setFocused(false)
    setHighlight(0)
    inputRef.current?.blur()
  }

  const inputValue = focused ? query : value
  const showList = focused && (filtered.length > 0 || query.trim().length > 0)

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
            setHighlight(h => Math.min(h + 1, Math.max(0, filtered.length - 1)))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight(h => Math.max(h - 1, 0))
          } else if (e.key === 'Enter') {
            const pick = filtered[highlight]
            if (pick) { e.preventDefault(); commit(pick) }
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
          {filtered.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--muted)' }}>No matches</div>
          ) : (
            filtered.map((c, i) => (
              <button
                key={c}
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
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : undefined,
                  background: i === highlight ? 'var(--navy-lt)' : c === value ? 'rgba(30, 92, 199, 0.08)' : 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                {c}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

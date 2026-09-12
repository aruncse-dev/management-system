import { useState, useMemo } from 'react'
import { Pencil, Trash2, X as XIcon, AlertTriangle, Package } from 'lucide-react'
import { useStore } from '../store'
import { budgetAppliesToLabelMonth, budgetMonthRange } from '../expenseCycle'
import { catMap, budgetSummary, monthYearApiKey } from '../utils'
import { useMoneyFormatting } from '../hooks/useFormatMoney'
import { BUDGET_GLOBAL_MONTH_KEY, MNS } from '../config'
import { api } from '../api'
import { BudgetMonthRangeFields } from '../components/BudgetMonthRangeFields'
import { CatIcon } from '../ui'
import { InfoCallout, KpiCard, KpiGrid, SearchField, SectionBlock, SectionChip, UiCard } from '../ui'

interface Props { showStatus: (msg: string) => void; onCategoryClick: (cat: string) => void }

/** `2026-06` → `Jun 2026`. The raw key is a storage detail, not a label. */
function monthKeyLabel(key: string): string {
  const [y, m] = key.split('-')
  const idx = Number(m) - 1
  return MNS[idx] ? `${MNS[idx]} ${y}` : key
}

type ModalMode = 'add' | 'edit' | 'delete' | null
interface ModalState { mode: ModalMode; id: string; cat: string; val: string; startMonth: string | null; endMonth: string | null }

export default function Budget({ showStatus, onCategoryClick }: Props) {
  const { state, dispatch } = useStore()
  const { format: fmt, currency, zeroPlaceholder } = useMoneyFormatting()
  const { budget, rows, month, year } = state
  const cm = catMap(rows, budget)
  const viewMonthKey = monthYearApiKey(month, year)
  const listed = budget.filter(
    e => e.name.trim() && budgetAppliesToLabelMonth(e, viewMonthKey),
  )
  // Summarise the rows actually on screen. This used to total the *unfiltered*
  // `budget`, so the KPI counted budgets that do not apply to the displayed
  // month — disagreeing both with the rows beneath it and with the dashboard,
  // which has always filtered.
  const { totalBudget, totalSpent, ovCount, totalOver } = budgetSummary(listed, cm)
  const [modal, setModal] = useState<ModalState>({ mode: null, id: '', cat: '', val: '', startMonth: null, endMonth: null })
  const [saving, setSaving] = useState(false)
  const [catSheet, setCatSheet] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const remaining = totalBudget - totalSpent

  const filtered = useMemo(
    () => listed.filter(e => e.name.toLowerCase().includes(search.toLowerCase())),
    [listed, search],
  )
  /**
   * Two groups, not one list of 38. The top of the page should be the lines that
   * need a decision; everything healthy sorts below it.
   */
  const GROUPS = useMemo(() => {
    const needs = filtered
      .filter(e => (cm[e.name] || 0) > e.amount || e.amount <= 0)
      .sort((a, b) => ((cm[b.name] || 0) - b.amount) - ((cm[a.name] || 0) - a.amount))
    const ok = filtered
      .filter(e => !needs.includes(e))
      .sort((a, b) => (cm[b.name] || 0) - (cm[a.name] || 0))
    return [
      { key: 'needs', title: 'Needs attention', icon: <AlertTriangle size={14} />, rows: needs },
      { key: 'ok', title: 'On track', icon: <Package size={14} />, rows: ok },
    ]
  }, [filtered, cm])

  /** Same name budgeted twice in one cycle inflates the total silently. */
  const duplicateNames = useMemo(() => {
    const seen = new Map<string, number>()
    for (const e of listed) seen.set(e.name, (seen.get(e.name) || 0) + 1)
    return [...seen.entries()].filter(([, n]) => n > 1).map(([n]) => n)
  }, [listed])

  const monthOptions = useMemo(() => {
    const now = new Date(parseInt(year, 10), MNS.indexOf(month as any))
    const opts: Array<{ label: string; value: string }> = []
    for (let i = -24; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const mIdx = d.getMonth()
      opts.push({ label: `${MNS[mIdx]} ${y}`, value: `${y}-${m}` })
    }
    return opts
  }, [month, year])

  function openEdit(id: string, cat: string, budg: number, start: string | null, end: string | null) {
    setModal({ mode: 'edit', id, cat, val: String(budg), startMonth: start, endMonth: end })
  }
  function openDelete(id: string, cat: string) { setModal({ mode: 'delete', id, cat, val: '', startMonth: null, endMonth: null }) }
  function closeModal() {
    setModal({ mode: null, id: '', cat: '', val: '', startMonth: null, endMonth: null })
  }

  async function confirmAdd() {
    const val = parseFloat(modal.val)
    const name = modal.cat.trim()
    if (!name || isNaN(val) || val < 0) { showStatus('⚠ Enter name and a valid amount'); return }
    setSaving(true)
    try {
      await api.addBudgetEntry(name, val, modal.startMonth, modal.endMonth)
      api.invalidateCache({ action: 'getBudget' })
      api.invalidateCache({ action: 'init' })
      const init = await api.init(month, year)
      dispatch({ type: 'SET_BUDGET', payload: init.budget })
      showStatus('✓ Budget saved')
      closeModal()
    } catch (e) { showStatus('⚠ ' + (e instanceof Error ? e.message : 'Save failed')) }
    finally { setSaving(false) }
  }

  async function confirmEdit() {
    const val = parseFloat(modal.val)
    const name = modal.cat.trim()
    if (!name || isNaN(val) || val < 0) { closeModal(); return }
    setSaving(true)
    try {
      await api.updateBudgetEntry(modal.id, name, val, modal.startMonth, modal.endMonth)
      api.invalidateCache({ action: 'getBudget' })
      api.invalidateCache({ action: 'init' })
      const init = await api.init(month, year)
      dispatch({ type: 'SET_BUDGET', payload: init.budget })
      showStatus('✓ Budget updated')
      closeModal()
    } catch (e) { showStatus('⚠ ' + (e instanceof Error ? e.message : 'Save failed')) }
    finally { setSaving(false) }
  }

  async function confirmDelete() {
    setSaving(true)
    try {
      await api.deleteBudgetEntry(modal.id)
      api.invalidateCache({ action: 'getBudget' })
      api.invalidateCache({ action: 'init' })
      const init = await api.init(month, year)
      dispatch({ type: 'SET_BUDGET', payload: init.budget })
      showStatus('✓ Budget removed')
      closeModal()
    } catch (e) { showStatus('⚠ ' + (e instanceof Error ? e.message : 'Delete failed')) }
    finally { setSaving(false) }
  }

  return (
    <div className="pg ui-kit-page-shell monthly-subpage">
      <SectionBlock title="Budget Management" icon={<Package size={14} />}>
        <KpiGrid variant="compact">
          <KpiCard label="Budget" value={fmt(totalBudget)} tone="navy" icon={<Package size={14} />} />
          <KpiCard label="Spent" value={fmt(totalSpent)} tone="red" icon={<AlertTriangle size={14} />} />
          <KpiCard label={totalOver ? 'Over' : 'Remaining'} value={`${totalOver ? '−' : ''}${fmt(Math.abs(remaining))}`} tone={totalOver ? 'red' : 'green'} icon={<Package size={14} />} />
          <KpiCard label="Overspent" value={String(ovCount)} tone="amber" icon={<AlertTriangle size={14} />} />
        </KpiGrid>
      </SectionBlock>

      <SearchField
        value={search}
        placeholder="Search categories"
        onChange={setSearch}
        onClear={() => setSearch('')}
      />

      {duplicateNames.length ? (
        <InfoCallout title="Duplicate budget lines" tone="amber">
          {duplicateNames.join(', ')} {duplicateNames.length === 1 ? 'has' : 'have'} more than one
          active line this cycle. Spend counts once but the budget counts every line, so the total
          above is higher than intended.
        </InfoCallout>
      ) : null}

      {GROUPS.map(({ key, title, icon, rows: groupRows }) => groupRows.length ? (
      <SectionBlock
        key={key}
        title={title}
        icon={icon}
        right={<SectionChip>{groupRows.length}</SectionChip>}
      >
        <div className="budget-list">
        {groupRows.map(({ id, name: cat, amount: budg, monthYear: budMy, startMonth, endMonth }) => {
          const spent = cm[cat] || 0
          const over = spent > budg
          const rowRemaining = budg - spent
          const pct = budg > 0 ? (spent / budg) * 100 : 0
          const status = over ? 'OVER' : pct >= 90 ? 'CRITICAL' : pct >= 75 ? 'NEAR' : 'OK'
          const badgeClass = over ? 'budget-badge over' : pct >= 90 ? 'budget-badge critical' : pct >= 75 ? 'budget-badge near' : 'budget-badge ok'
          // Read through `budgetMonthRange` so a legacy `monthYear`-only row
          // gets a badge too, and label the months rather than printing the raw
          // `2026-06` key at the user.
          const range = budgetMonthRange({ monthYear: budMy, startMonth: startMonth ?? null, endMonth: endMonth ?? null })
          const dateRangeBadge =
            range.start && range.end && range.start === range.end
              ? monthKeyLabel(range.start)
              : range.start && !range.end
                ? `From ${monthKeyLabel(range.start)}`
                : !range.start && range.end
                  ? `Until ${monthKeyLabel(range.end)}`
                  : range.start && range.end
                    ? `${monthKeyLabel(range.start)} – ${monthKeyLabel(range.end)}`
                    : null
          return (
            <UiCard
              key={id}
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <CatIcon cat={cat} size={14} />
                  {cat}
                  {dateRangeBadge && (
                    <span className="budget-badge near" style={{ fontSize: 10 }}>{dateRangeBadge}</span>
                  )}
                </span>
              }
              right={<div className="budget-row-actions">
                <span className={badgeClass}>{status}</span>
                <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openEdit(id, cat, budg, startMonth ?? null, endMonth ?? null) }} aria-label={`Edit ${cat}`} title={`Edit ${cat}`}><Pencil size={13} /></button>
                <button className="icon-btn" style={{color:'var(--red)'}} onClick={(e) => { e.stopPropagation(); openDelete(id, cat) }} aria-label={`Delete ${cat}`} title={`Delete ${cat}`}><Trash2 size={13} /></button>
              </div>}
            >
              <div className="budget-row-grid" onClick={() => setCatSheet(cat)} style={{ cursor: 'pointer' }}>
                <div>
                  <div className="budget-mini-lbl">Budget</div>
                  <div className="budget-mini-val">{fmt(budg)}</div>
                </div>
                <div>
                  <div className="budget-mini-lbl">Spent</div>
                  <div className="budget-mini-val">{fmt(spent)}</div>
                </div>
                <div className="budget-mini-right">
                  <div className="budget-mini-lbl">{over ? 'Over' : 'Left'}</div>
                  <div className="budget-mini-val" style={{ color: over ? 'var(--red)' : 'var(--gm)' }}>{fmt(Math.abs(rowRemaining))}</div>
                </div>
              </div>
            </UiCard>
          )
        })}
        </div>
      </SectionBlock>
      ) : null)}

      {!listed.length && <div className="lb">No budget categories. Click "+ Add".</div>}
      {listed.length > 0 && !filtered.length && <div className="lb">No matching categories.</div>}

      {/* Modal */}
      <div className={`modal-bg ${modal.mode ? 'open' : ''}`} onClick={closeModal}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          {modal.mode === 'delete' ? (
            <>
              <div className="modal-hd modal-hd--blue">
                <span className="modal-title">Remove Budget</span>
                <button className="modal-close" onClick={closeModal}><XIcon size={16} /></button>
              </div>
              <div className="modal-body">
                <div style={{display:'flex',flexDirection:'column',gap:8,fontSize:14,color:'var(--text)'}}>
                  <div>
                    Remove budget for <b style={{display:'inline-flex',alignItems:'center',gap:4}}><CatIcon cat={modal.cat} size={13} />{modal.cat}</b>?
                  </div>
                  <div style={{color:'var(--muted)'}}>
                    This will not delete transactions.
                  </div>
                </div>
              </div>
              <div className="modal-foot">
                <div className="modal-foot-l" />
                <button className="btn btn-sm btn-cancel" onClick={closeModal}>Cancel</button>
                <button className="btn btn-sm" style={{background:'var(--red)',color:'#fff'}} onClick={confirmDelete} disabled={saving}>
                  {saving ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="modal-hd modal-hd--blue">
                <span className="modal-title">
                  {modal.mode === 'add' ? 'Add Budget' : 'Edit Budget'}
                </span>
                <button className="modal-close" onClick={closeModal}><XIcon size={16} /></button>
              </div>
              <div className="modal-body">
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Budget name</div>
                  <input
                    className="form-inp"
                    type="text"
                    placeholder={modal.mode === 'add' ? 'e.g. Groceries' : ''}
                    value={modal.cat}
                    onChange={e => setModal(m => ({ ...m, cat: e.target.value }))}
                    autoFocus={modal.mode === 'add'}
                  />
                </div>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>{`Budget amount (${currency})`}</div>
                  <input
                    className="form-inp" type="number" placeholder={zeroPlaceholder}
                    value={modal.val} autoFocus={modal.mode === 'edit'}
                    onChange={e => setModal(m => ({...m, val: e.target.value}))}
                    onKeyDown={e => { if (e.key === 'Enter') { modal.mode === 'add' ? confirmAdd() : confirmEdit() } }}
                  />
                </div>
                {(modal.mode === 'add' || modal.mode === 'edit') && (
                  <BudgetMonthRangeFields
                    startMonth={modal.startMonth}
                    endMonth={modal.endMonth}
                    onStartChange={startMonth => setModal(m => ({ ...m, startMonth }))}
                    onEndChange={endMonth => setModal(m => ({ ...m, endMonth }))}
                    monthOptions={monthOptions}
                    defaultMonthKey={monthYearApiKey(month, year)}
                  />
                )}
              </div>
              <div className="modal-foot">
                <div className="modal-foot-l" />
                <button className="btn btn-sm btn-cancel" onClick={closeModal}>Cancel</button>
                <button className="btn btn-sm btn-green" onClick={modal.mode === 'add' ? confirmAdd : confirmEdit} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category Transaction Bottom Sheet */}
      {catSheet && (() => {
        const sheetBudg = budget.find(e => e.name === catSheet)?.amount ?? 0
        const sheetSpent = cm[catSheet] || 0
        const sheetOver = sheetSpent > sheetBudg
        return (
        <div className={`modal-bg ${catSheet ? 'open' : ''}`} onClick={() => setCatSheet(null)} style={{position:'fixed',inset:0,zIndex:1000}}>
          <div className="sheet-panel" onClick={e => e.stopPropagation()}>
            <div className="sheet-hd modal-hd--blue">
              <h3 className="sheet-title">{catSheet}</h3>
              <button className="modal-close" onClick={() => setCatSheet(null)} style={{padding:0}}><XIcon size={20} /></button>
            </div>

              <div className="sheet-stats" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
              <div className="card" style={{padding:'10px 12px'}}>
                <div className="lbl">Budget</div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginTop:4}}>{fmt(sheetBudg)}</div>
              </div>
              <div className="card" style={{padding:'10px 12px'}}>
                <div className="lbl">Spent</div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginTop:4}}>{fmt(sheetSpent)}</div>
              </div>
              <div className="card" style={{padding:'10px 12px',background: sheetOver ? 'rgba(239,68,68,.08)' : 'rgba(34,197,94,.08)'}}>
                <div className="lbl">{sheetOver ? 'Over' : 'Left'}</div>
                <div style={{fontSize:14,fontWeight:700,color: sheetOver ? 'var(--rm)' : 'var(--gm)',marginTop:4}}>
                  {fmt(Math.abs(sheetBudg - sheetSpent))}
                </div>
              </div>
            </div>

            <div className="sheet-body">
              {rows.filter(r => r.c === catSheet).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).length === 0 ? (
                <p style={{color:'var(--muted)',textAlign:'center',padding:'1rem 0',fontSize:14}}>No transactions in this category.</p>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {rows.filter(r => r.c === catSheet).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(txn => (
                    <div key={txn.id} className="card" style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',cursor:'pointer'}} onClick={() => {setCatSheet(null); onCategoryClick(catSheet)}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:13,color:'var(--text)'}}>{txn.desc}</div>
                        {txn.notes && <div style={{fontSize:11,color:'var(--muted)',marginTop:1}}>{txn.notes}</div>}
                        <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{txn.m}</div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontWeight:700,fontSize:14,color:'var(--rm)'}}>{fmt(txn.a)}</div>
                        <div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>{txn.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  )
}

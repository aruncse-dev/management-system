import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ChevronLeft, ChevronRight, Plus, X as XIcon, Zap } from 'lucide-react'
import { useRouter } from 'next/router'
import { useStore } from '../store'
import { api } from '../api'
import type { Transaction } from '../types'
import { BottomNav, TransactionModal } from '../ui'
import Dashboard from './dashboard'
import Transactions from './transactions'
import Budget from './budget'
import { MNS } from '../config'
import { BudgetMonthRangeFields } from '../components/BudgetMonthRangeFields'
import { QuickAddBar } from '../components/QuickAddBar'
import { expenseCategoriesWithBudget, incomeCategoriesWithBudget, isoDate, monthYearApiKey } from '../utils'
import { useFintrackerModes } from '../context/FintrackerModesContext'
import { cycleMonthYearForDate, cycleSubtitle } from '../expenseCycle'
import { useMoneyFormatting } from '../hooks/useFormatMoney'
import { useTransactionRefOptions } from '../hooks/useTransactionRefOptions'
import { useKeyboardInset } from '../hooks/useKeyboardInset'
import { readSnapshot, writeSnapshot } from '../lib/snapshotCache'

type TabId = 'dash' | 'txns' | 'bud'

const TAB_Q: Record<TabId, string> = { dash: 'dash', txns: 'txns', bud: 'bud' }

/**
 * A copy of `row` for the add form: no id, dated today.
 *
 * `Transaction.date` is `DD-MMM-YY`, not ISO — writing ISO here made the modal's
 * parser fail and silently fall back to today, which looked right by accident.
 */
function duplicateOf(row: Transaction): Transaction {
  const d = new Date()
  const today = `${String(d.getDate()).padStart(2, '0')}-${MNS[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`
  return { ...row, id: '', date: today }
}

export default function Monthly() {
  const router = useRouter()
  const { state, dispatch } = useStore()
  const money = useMoneyFormatting()
  const { paymentModeOptions, transferTargetOptions } = useFintrackerModes()
  const [tab, setTab] = useState<TabId>('dash')
  const [modalOpen, setModalOpen] = useState(false)
  // Eight requests (loans, lending books, policies…) that only the full form
  // uses. They used to fire on every visit to Monthly, competing with the
  // month itself; now they load the first time the form opens.
  const refOptions = useTransactionRefOptions(modalOpen)
  /** The floating one-line entry. Opened by the plus button on every tab but Budget. */
  const [quickOpen, setQuickOpen] = useState(false)
  /** Line handed in by a link (`?quick=1&q=4200 LIC Insurance HDFC`). Shown, never auto-saved. */
  const [quickPrefill, setQuickPrefill] = useState('')
  const keyboardInset = useKeyboardInset(quickOpen)
  /** Forces TransactionModal to remount; duplicated rows all share id ''. */
  const [modalNonce, setModalNonce] = useState(0)
  const [editRow, setEditRow] = useState<typeof state.rows[0] | null>(null)
  const [snackbar, setSnackbar] = useState<{ msg: string; variant: 'success' | 'error' | 'info' } | null>(null)
  const snackbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [budgetAddOpen, setBudgetAddOpen] = useState(false)
  const [budgetName, setBudgetName] = useState('')
  const [budgetVal, setBudgetVal] = useState('')
  const [budgetSaving, setBudgetSaving] = useState(false)
  const [budgetStartMonth, setBudgetStartMonth] = useState<string | null>(null)
  const [budgetEndMonth, setBudgetEndMonth] = useState<string | null>(null)

  const closeBudgetAdd = useCallback(() => {
    setBudgetAddOpen(false)
    setBudgetName('')
    setBudgetVal('')
    setBudgetStartMonth(null)
    setBudgetEndMonth(null)
  }, [])

  // Home-screen shortcut "Add expense" lands on /monthly?quick=1: open the
  // quick-add box straight away, then drop the flag so a reload does not.
  useEffect(() => {
    if (!router.isReady || router.query.quick !== '1') return
    const q = typeof router.query.q === 'string' ? router.query.q.slice(0, 200) : ''
    setQuickPrefill(q)
    setQuickOpen(true)
    const { quick: _quick, q: _q, ...rest } = router.query
    void _quick
    void _q
    void router.replace({ pathname: '/monthly', query: { tab: 'dash', ...rest } }, undefined, { shallow: true })
  }, [router])

  const goTab = useCallback(
    (id: TabId) => {
      setTab(id)
      void router.replace({ pathname: '/monthly', query: { tab: TAB_Q[id] } }, undefined, { shallow: true })
    },
    [router],
  )

  useEffect(() => {
    if (!router.isReady || router.pathname !== '/monthly') return
    const q = router.query.tab
    const raw = typeof q === 'string' ? q : Array.isArray(q) ? q[0] : undefined
    // `cc` and `acct` were the Credits and Accounts tabs; both now live in the
    // dashboard's Sources section, so old links land there rather than 404.
    const fromQuery: Record<string, TabId> = { dash: 'dash', txns: 'txns', bud: 'bud', cc: 'dash', acct: 'dash' }
    if (raw && fromQuery[raw]) {
      setTab(fromQuery[raw])
      return
    }
    setTab('dash')
    if (raw === undefined) {
      void router.replace({ pathname: '/monthly', query: { tab: 'dash' } }, undefined, { shallow: true })
    }
  }, [router.isReady, router.pathname, router.query.tab, router])

  /** The cycle on screen, for discarding responses that arrive after the user moved on. */
  const viewRef = useRef({ month: state.month, year: state.year })
  viewRef.current = { month: state.month, year: state.year }

  const showStatus = useCallback((msg: string) => {
    if (snackbarTimerRef.current) clearTimeout(snackbarTimerRef.current)
    const variant: 'success' | 'error' | 'info' = msg.includes('✓')
      ? 'success'
      : msg.includes('⚠')
        ? 'error'
        : 'info'
    setSnackbar({ msg, variant })
    snackbarTimerRef.current = setTimeout(() => {
      setSnackbar(null)
      snackbarTimerRef.current = null
    }, 3200)
  }, [])

  useEffect(() => {
    return () => {
      if (snackbarTimerRef.current) clearTimeout(snackbarTimerRef.current)
    }
  }, [])

  /**
   * Load a cycle's rows.
   *
   * The last copy on this device paints first, so opening the app shows the
   * month at once instead of a spinner for a full round trip. `quiet` is for
   * refreshes after a save: the list already holds the new row, and flipping
   * the whole dashboard to a spinner after every entry was the slowest part
   * of adding a spend.
   */
  const loadMonth = useCallback(async (month: string, year: string, opts: { quiet?: boolean } = {}) => {
    const snapKey = `rows:${month}-${year}`
    const snap = opts.quiet ? null : readSnapshot<Transaction[]>(snapKey)
    if (snap) {
      dispatch({ type: 'SET_ROWS', payload: snap })
      dispatch({ type: 'SET_LOADING', payload: false })
    } else if (!opts.quiet) {
      dispatch({ type: 'SET_LOADING', payload: true })
    }
    try {
      const rows = await api.getData(month, year)
      // Ignore a response for a month that is no longer on screen.
      if (viewRef.current.month !== month || viewRef.current.year !== year) return
      dispatch({ type: 'SET_ROWS', payload: rows })
      writeSnapshot(snapKey, rows)
    } catch (e) {
      showStatus('⚠ ' + (e instanceof Error ? e.message : 'Load failed'))
    } finally {
      if (!opts.quiet && viewRef.current.month === month && viewRef.current.year === year) {
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }
  }, [dispatch, showStatus])

  useEffect(() => {
    void loadMonth(state.month, state.year).catch(() => {
      showStatus('⚠ Failed to connect to backend')
      dispatch({ type: 'SET_LOADING', payload: false })
    })
  }, [state.month, state.year, loadMonth, dispatch, showStatus])

  const expenseCategoryOptions = useMemo(
    () => expenseCategoriesWithBudget(state.budget),
    [state.budget],
  )
  const incomeCategoryOptions = useMemo(
    () => incomeCategoriesWithBudget(state.budget),
    [state.budget],
  )

  const changeMonth = useCallback(async (dir: 1 | -1) => {
    const idx = MNS.indexOf(state.month as typeof MNS[number])
    let newIdx = idx + dir
    let newYear = parseInt(state.year)
    if (newIdx < 0) { newIdx = 11; newYear-- }
    if (newIdx > 11) { newIdx = 0; newYear++ }
    const newMonth = MNS[newIdx]
    dispatch({ type: 'SET_MONTH', payload: { month: newMonth, year: String(newYear) } })
  }, [state.month, state.year, dispatch])

  /**
   * "✓ Saved", or "✓ Saved to Oct 2026 (19 Sep – 18 Oct)" when the date files
   * the row under a different cycle than the one on screen. Without this the
   * row simply never appears in the open list and looks lost.
   */
  const savedStatus = useCallback(
    (dateUi?: string) => {
      if (!dateUi) return '✓ Saved'
      try {
        const { month, year } = cycleMonthYearForDate(isoDate(dateUi), state.fintracker)
        if (month === state.month && year === state.year) return '✓ Saved'
        return `✓ Saved to ${month} ${year} (${cycleSubtitle(month, year, state.fintracker)})`
      } catch {
        return '✓ Saved'
      }
    },
    [state.fintracker, state.month, state.year],
  )

  const budgetMonthOptions = useMemo(() => {
    const now = new Date(parseInt(state.year, 10), MNS.indexOf(state.month as typeof MNS[number]))
    const opts: Array<{ label: string; value: string }> = []
    for (let i = -24; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const mIdx = d.getMonth()
      opts.push({ label: `${MNS[mIdx]} ${y}`, value: `${y}-${m}` })
    }
    return opts
  }, [state.month, state.year])

  const addBudget = useCallback(async () => {
    const val = parseFloat(budgetVal)
    const name = budgetName.trim()
    if (!name || isNaN(val) || val < 0) {
      showStatus('⚠ Enter name and a valid amount')
      return
    }
    setBudgetSaving(true)
    try {
      await api.addBudgetEntry(name, val, budgetStartMonth, budgetEndMonth)
      api.invalidateCache({ action: 'getBudget' })
      api.invalidateCache({ action: 'init' })
      const init = await api.init(state.month, state.year)
      dispatch({ type: 'SET_BUDGET', payload: init.budget })
      showStatus('✓ Budget saved')
      closeBudgetAdd()
    } catch (e) {
      showStatus('⚠ ' + (e instanceof Error ? e.message : 'Save failed'))
    } finally {
      setBudgetSaving(false)
    }
  }, [budgetEndMonth, budgetName, budgetStartMonth, budgetVal, closeBudgetAdd, dispatch, showStatus, state.month, state.year])

  return (
    <div className="monthly-wrap">
      {/* Month nav sub-header */}
      <nav className="nav-sub">
        <div className="nav-month" style={{ flex: 1, justifyContent: 'center' }}>
          <button className="nav-arrow" onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button>
          <div className="nav-ml">
            {state.month} {state.year}
            <div style={{ fontSize: 9, opacity: .65, fontWeight: 400 }}>{cycleSubtitle(state.month, state.year, state.fintracker)}</div>
          </div>
          <button className="nav-arrow" onClick={() => changeMonth(1)}><ChevronRight size={16} /></button>
        </div>
      </nav>

      <BottomNav tab={tab} onTab={goTab} />

      <main>
        {tab === 'dash' && (
          <Dashboard
            onCategoryClick={cat => { dispatch({ type: 'SET_CAT_FILTER', payload: cat }); goTab('txns') }}
          />
        )}
        {tab === 'txns' && (
          <Transactions
            onEdit={r => {
              // Still saving: there is no server id to edit yet.
              if (r.id.startsWith('pending-')) return
              setEditRow(r); setModalOpen(true); setModalNonce(n => n + 1)
            }}
            onDuplicate={r => { setEditRow(duplicateOf(r)); setModalOpen(true); setModalNonce(n => n + 1) }}
          />
        )}
        {tab === 'bud'  && <Budget showStatus={showStatus} onCategoryClick={cat => { dispatch({ type:'SET_CAT_FILTER', payload:cat }); goTab('txns') }} />}
      </main>

      {/* Quick add, floating. Rendered here rather than inside a tab so it is
          reachable from the dashboard, which is where you usually are when you
          remember a spend. */}
      {quickOpen && tab !== 'bud' && (
        <div
          className="quickadd-pop"
          style={keyboardInset ? { bottom: keyboardInset + 8 } : undefined}
        >
          <QuickAddBar
            month={state.month}
            year={state.year}
            categories={expenseCategoryOptions}
            incomeCategories={incomeCategoryOptions}
            modes={paymentModeOptions}
            showStatus={showStatus}
            initialText={quickPrefill}
            onClose={() => { setQuickOpen(false); setQuickPrefill('') }}
            onSubmit={async (payload, row) => {
              // Show it now if it belongs to the cycle on screen; a row dated
              // into another cycle is only announced, as before.
              let here = false
              try {
                const c = cycleMonthYearForDate(isoDate(row.date), state.fintracker)
                here = c.month === state.month && c.year === state.year
              } catch {
                /* unparseable date: let the server decide */
              }
              if (here) dispatch({ type: 'ADD_ROW', payload: row })
              try {
                const id = await api.addRow(payload)
                if (here) dispatch({ type: 'REPLACE_ROW_ID', payload: { from: row.id, to: id } })
                showStatus(savedStatus(row.date))
              } catch (e) {
                if (here) dispatch({ type: 'REMOVE_ROW', payload: row.id })
                throw e
              }
              // Reconcile quietly (server-side mirrors, other devices).
              void loadMonth(state.month, state.year, { quiet: true })
            }}
            onExpand={draft => {
              setQuickOpen(false)
              setEditRow(draft)
              setModalOpen(true)
              setModalNonce(n => n + 1)
            }}
          />
        </div>
      )}

      {/* Two buttons rather than one that opens a menu: quick add and the full
          form are both one tap, and neither hides behind the other. The stack
          collapses to the single plus on Budget, which has no quick path. */}
      {!(quickOpen && tab !== 'bud') && (
        <div className="fab-stack">
          {tab !== 'bud' && (
            <button
              type="button"
              className="fab fab--mini"
              onClick={() => setQuickOpen(true)}
              title="Quick add"
              aria-label="Quick add a transaction"
            >
              <Zap size={18} />
            </button>
        )}
        <button
          type="button"
          className="fab"
          onClick={() => {
            if (tab === 'bud') {
              setBudgetAddOpen(true)
              return
            }
            setEditRow(null)
            setModalOpen(true)
            setModalNonce(n => n + 1)
          }}
          title={tab === 'bud' ? 'Add budget' : 'Add transaction'}
          aria-label={tab === 'bud' ? 'Add budget' : 'Add transaction'}
        >
          <Plus size={24} />
        </button>
      </div>
      )}

      {budgetAddOpen && (
        <div className="modal-bg open" onClick={closeBudgetAdd}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd modal-hd--blue">
              <span className="modal-title">Add Budget</span>
              <button className="modal-close" onClick={closeBudgetAdd}><XIcon size={16} /></button>
            </div>
            <div className="modal-body">
              <div>
                <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Budget name</div>
                <input
                  className="form-inp"
                  type="text"
                  placeholder="e.g. Groceries"
                  value={budgetName}
                  onChange={e => setBudgetName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>{`Budget amount (${money.currency})`}</div>
                <input className="form-inp" type="number" placeholder={money.zeroPlaceholder} value={budgetVal} onChange={e => setBudgetVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addBudget() }} />
              </div>
              <BudgetMonthRangeFields
                startMonth={budgetStartMonth}
                endMonth={budgetEndMonth}
                onStartChange={setBudgetStartMonth}
                onEndChange={setBudgetEndMonth}
                monthOptions={budgetMonthOptions}
                defaultMonthKey={monthYearApiKey(state.month, state.year)}
              />
            </div>
            <div className="modal-foot">
              <div className="modal-foot-l" />
              <button className="btn btn-sm btn-cancel" onClick={closeBudgetAdd}>Cancel</button>
              <button className="btn btn-sm btn-green" onClick={addBudget} disabled={budgetSaving}>
                {budgetSaving ? '…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <TransactionModal
          key={`${editRow?.id || 'new'}-${modalNonce}-${paymentModeOptions.join('|')}--${transferTargetOptions.join('|')}`}
          row={editRow}
          month={state.month} year={state.year}
          api={api}
          paymentModeOptions={paymentModeOptions}
          transferTargetOptions={transferTargetOptions}
          expenseCategoryOptions={expenseCategoryOptions}
          incomeCategoryOptions={incomeCategoryOptions}
          amountLabel={`Amount (${money.currency})`}
          amountPlaceholder={money.zeroPlaceholder}
          refOptions={refOptions}
          onClose={() => setModalOpen(false)}
          onSaved={async (saved) => {
            setModalOpen(false)
            await loadMonth(state.month, state.year, { quiet: true })
            showStatus(savedStatus(saved?.date))
          }}
          showStatus={showStatus}
        />
      )}

      {snackbar && (
        <div className="fintracker-snackbar" role="status" aria-live="polite" data-variant={snackbar.variant}>
          {snackbar.msg}
        </div>
      )}
    </div>
  )
}

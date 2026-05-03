import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, X as XIcon } from 'lucide-react'
import { useRouter } from 'next/router'
import { useStore } from '../store'
import { api } from '../api'
import { BottomNav, TransactionModal } from '../ui'
import Dashboard from './dashboard'
import Transactions from './transactions'
import Budget from './budget'
import Credits from './credits'
import Accounts from './accounts'
import { MNS } from '../config'
import { expenseCategoriesWithBudget, incomeCategoriesWithBudget } from '../utils'

type TabId = 'dash' | 'txns' | 'bud' | 'cc' | 'acct'

const CC_CYCLE_DAY = 19
function cycleSubtitle(month: string) {
  const mi = MNS.indexOf(month as typeof MNS[number])
  const prevMi = mi === 0 ? 11 : mi - 1
  return `${CC_CYCLE_DAY} ${MNS[prevMi]} – ${CC_CYCLE_DAY - 1} ${month}`
}

const TAB_Q: Record<TabId, string> = { dash: 'dash', txns: 'txns', bud: 'bud', cc: 'cc', acct: 'acct' }

export default function Monthly() {
  const router = useRouter()
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState<TabId>('dash')
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<typeof state.rows[0] | null>(null)
  const [status, setStatus] = useState('')
  const [budgetAddOpen, setBudgetAddOpen] = useState(false)
  const [budgetName, setBudgetName] = useState('')
  const [budgetVal, setBudgetVal] = useState('')
  const [budgetSaving, setBudgetSaving] = useState(false)

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
    const fromQuery: Record<string, TabId> = { dash: 'dash', txns: 'txns', bud: 'bud', cc: 'cc', acct: 'acct' }
    if (raw && fromQuery[raw]) {
      setTab(fromQuery[raw])
      return
    }
    setTab('dash')
    if (raw === undefined) {
      void router.replace({ pathname: '/monthly', query: { tab: 'dash' } }, undefined, { shallow: true })
    }
  }, [router.isReady, router.pathname, router.query.tab, router])

  const showStatus = useCallback((msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(''), 3000)
  }, [])

  const loadMonth = useCallback(async (month: string, year: string, forceRefresh = false) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      if (forceRefresh) {
        api.invalidateCache({ action: 'getData', params: { month, year } })
      }
      const rows = await api.getData(month, year)
      dispatch({ type: 'SET_ROWS', payload: rows })
    } catch (e) {
      showStatus('⚠ ' + (e instanceof Error ? e.message : 'Load failed'))
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [dispatch, showStatus])

  useEffect(() => {
    void loadMonth(state.month, state.year).catch(() => {
      showStatus('⚠ Failed to connect to backend')
      dispatch({ type: 'SET_LOADING', payload: false })
    })
  }, []) // eslint-disable-line

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
    await loadMonth(newMonth, String(newYear))
  }, [state.month, state.year, dispatch, loadMonth])

  const addBudget = useCallback(async () => {
    const val = parseFloat(budgetVal)
    const name = budgetName.trim()
    if (!name || isNaN(val) || val < 0) {
      showStatus('⚠ Enter name and a valid amount')
      return
    }
    setBudgetSaving(true)
    try {
      const entry = await api.addBudgetEntry(name, val)
      api.invalidateCache({ action: 'getBudget' })
      api.invalidateCache({ action: 'init' })
      dispatch({ type: 'SET_BUDGET', payload: [...state.budget, entry] })
      showStatus('✓ Budget saved')
      setBudgetAddOpen(false)
      setBudgetName('')
      setBudgetVal('')
    } catch (e) {
      showStatus('⚠ ' + (e instanceof Error ? e.message : 'Save failed'))
    } finally {
      setBudgetSaving(false)
    }
  }, [budgetName, budgetVal, dispatch, showStatus, state.budget])

  return (
    <div className="monthly-wrap">
      {/* Month nav sub-header */}
      <nav className="nav-sub">
        {status && <span className="nav-status show">{status}</span>}
        <div className="nav-month" style={{ flex: 1, justifyContent: 'center' }}>
          <button className="nav-arrow" onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button>
          <div className="nav-ml">
            {state.month} {state.year}
            <div style={{ fontSize: 9, opacity: .65, fontWeight: 400 }}>{cycleSubtitle(state.month)}</div>
          </div>
          <button className="nav-arrow" onClick={() => changeMonth(1)}><ChevronRight size={16} /></button>
        </div>
      </nav>

      <BottomNav tab={tab} onTab={goTab} />

      <main>
        {tab === 'dash' && <Dashboard />}
        {tab === 'txns' && <Transactions onEdit={r => { setEditRow(r); setModalOpen(true) }} />}
        {tab === 'bud'  && <Budget showStatus={showStatus} onCategoryClick={cat => { dispatch({ type:'SET_CAT_FILTER', payload:cat }); goTab('txns') }} />}
        {tab === 'cc'   && <Credits />}
        {tab === 'acct' && <Accounts showStatus={showStatus} />}
      </main>

      {/* FAB */}
      <button
        onClick={() => {
          if (tab === 'bud') {
            setBudgetAddOpen(true)
            return
          }
          setEditRow(null)
          setModalOpen(true)
        }}
        style={{ position:'fixed', bottom:24, right:20, width:52, height:52, borderRadius:'50%', background:'var(--navy-dark)', color:'#fff', fontSize:24, border:'none', boxShadow:'0 4px 16px rgba(0,0,0,.2)', cursor:'pointer', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}
        title={tab === 'bud' ? 'Add budget' : 'Add transaction'}
      >+</button>

      {budgetAddOpen && (
        <div className="modal-bg open" onClick={() => setBudgetAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd modal-hd--blue">
              <span className="modal-title">Add Budget</span>
              <button className="modal-close" onClick={() => setBudgetAddOpen(false)}><XIcon size={16} /></button>
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
                <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Budget Amount (₹)</div>
                <input className="form-inp" type="number" placeholder="0" value={budgetVal} onChange={e => setBudgetVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addBudget() }} />
              </div>
            </div>
            <div className="modal-foot">
              <div className="modal-foot-l" />
              <button className="btn btn-sm btn-cancel" onClick={() => setBudgetAddOpen(false)}>Cancel</button>
              <button className="btn btn-sm btn-green" onClick={addBudget} disabled={budgetSaving}>
                {budgetSaving ? '…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <TransactionModal
          row={editRow}
          month={state.month} year={state.year}
          api={api}
          expenseCategoryOptions={expenseCategoryOptions}
          incomeCategoryOptions={incomeCategoryOptions}
          onClose={() => setModalOpen(false)}
          onSaved={async () => {
            setModalOpen(false)
            await loadMonth(state.month, state.year, true)
            showStatus('✓ Saved')
          }}
          showStatus={showStatus}
        />
      )}
    </div>
  )
}

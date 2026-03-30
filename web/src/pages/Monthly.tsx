import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Package, X as XIcon, Check } from 'lucide-react'
import { useStore } from '../store'
import { api } from '../api'
import BottomNav from '../components/BottomNav'
import Dashboard from './Dashboard'
import Transactions from './Transactions'
import Budget from './Budget'
import Credits from './Credits'
import Accounts from './Accounts'
import TransactionModal from '../components/TransactionModal'
import { CATEGORIES } from '../constants'
import { MNS } from '../constants'

type TabId = 'dash' | 'txns' | 'bud' | 'cc' | 'acct'

const CC_CYCLE_DAY = 19
function cycleSubtitle(month: string) {
  const mi = MNS.indexOf(month as typeof MNS[number])
  const prevMi = mi === 0 ? 11 : mi - 1
  return `${CC_CYCLE_DAY} ${MNS[prevMi]} – ${CC_CYCLE_DAY - 1} ${month}`
}

export default function Monthly() {
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState<TabId>('dash')
  const [modalOpen, setModalOpen] = useState(false)
  const [editRow, setEditRow] = useState<typeof state.rows[0] | null>(null)
  const [status, setStatus] = useState('')
  const [budgetAddOpen, setBudgetAddOpen] = useState(false)
  const [budgetCat, setBudgetCat] = useState<string>(CATEGORIES[0])
  const [budgetVal, setBudgetVal] = useState('')
  const [budgetSaving, setBudgetSaving] = useState(false)

  const showStatus = useCallback((msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(''), 3000)
  }, [])

  const loadMonth = useCallback(async (month: string, year: string) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    try {
      const rows = await api.getData(month, year)
      dispatch({ type: 'SET_ROWS', payload: rows })
      showStatus('✓ ' + month + ' ' + year)
    } catch (e) {
      showStatus('⚠ ' + (e instanceof Error ? e.message : 'Load failed'))
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [dispatch, showStatus])

  useEffect(() => {
    ;(async () => {
      try {
        const init = await api.init()
        dispatch({ type: 'SET_MONTHS', payload: init.months })
        dispatch({ type: 'SET_BUDGET', payload: init.budget })
        dispatch({ type: 'SET_OPENING_BAL', payload: init.openingBal })
        await loadMonth(state.month, state.year)
      } catch (e) {
        showStatus('⚠ ' + (e instanceof Error ? e.message : 'Failed to connect to backend'))
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    })()
  }, []) // eslint-disable-line

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
    if (!budgetCat || isNaN(val) || val <= 0) {
      showStatus('⚠ Enter category and amount')
      return
    }
    setBudgetSaving(true)
    try {
      await api.updateBudgetEntry(budgetCat, val)
      dispatch({ type: 'SET_BUDGET', payload: { ...state.budget, [budgetCat]: val } })
      showStatus('✓ Budget saved')
      setBudgetAddOpen(false)
      setBudgetVal('')
    } catch (e) {
      showStatus('⚠ ' + (e instanceof Error ? e.message : 'Save failed'))
    } finally {
      setBudgetSaving(false)
    }
  }, [budgetCat, budgetVal, dispatch, showStatus, state.budget])

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
        <button className="nav-sync" onClick={() => loadMonth(state.month, state.year)} disabled={state.loading}>
          {state.loading ? '…' : <RefreshCw size={13} />}
        </button>
      </nav>

      <BottomNav tab={tab} onTab={(id) => setTab(id)} />

      <main>
        {tab === 'dash' && <Dashboard />}
        {tab === 'txns' && <Transactions onEdit={r => { setEditRow(r); setModalOpen(true) }} />}
        {tab === 'bud'  && <Budget showStatus={showStatus} onCategoryClick={cat => { dispatch({ type:'SET_CAT_FILTER', payload:cat }); setTab('txns') }} />}
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
            <div className="modal-hd">
              <span className="modal-title" style={{display:'flex',alignItems:'center',gap:6}}>
                <Package size={15} /> Add Budget
              </span>
              <button className="modal-close" onClick={() => setBudgetAddOpen(false)}><XIcon size={16} /></button>
            </div>
            <div className="modal-body">
              <div>
                <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Category</div>
                <select className="form-sel" value={budgetCat} onChange={e => setBudgetCat(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Budget Amount (₹)</div>
                <input className="form-inp" type="number" placeholder="0" value={budgetVal} onChange={e => setBudgetVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addBudget() }} autoFocus />
              </div>
            </div>
            <div className="modal-foot">
              <div className="modal-foot-l" />
              <button className="btn btn-sm" style={{background:'var(--border)',color:'var(--text)'}} onClick={() => setBudgetAddOpen(false)}><XIcon size={13} />Cancel</button>
              <button className="btn btn-sm btn-green" onClick={addBudget} disabled={budgetSaving}>
                <Check size={13} />{budgetSaving ? '…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <TransactionModal
          row={editRow}
          month={state.month} year={state.year}
          onClose={() => setModalOpen(false)}
          onSaved={async () => {
            setModalOpen(false)
            await loadMonth(state.month, state.year)
            showStatus('✓ Saved')
          }}
          showStatus={showStatus}
        />
      )}
    </div>
  )
}

import { useState } from 'react'
import { Pencil, Trash2, Plus, Check, X as XIcon, AlertTriangle, Package } from 'lucide-react'
import { useStore } from '../store'
import { catMap, budgetSummary, INR } from '../utils'
import { api } from '../api'
import { CATEGORIES } from '../constants'
import CatIcon from '../components/CatIcon'
import { decorColor } from '../constants'
import { UiSection } from '../components/FinanceUI'

interface Props { showStatus: (msg: string) => void; onCategoryClick: (cat: string) => void }

type ModalMode = 'add' | 'edit' | 'delete' | 'reset' | null
interface ModalState { mode: ModalMode; cat: string; val: string }

export default function Budget({ showStatus, onCategoryClick }: Props) {
  const { state, dispatch } = useStore()
  const { budget, rows } = state
  const cm = catMap(rows, budget)
  const { totalBudget, totalSpent, ovCount, totalOver } = budgetSummary(budget, cm)
  const active = Object.entries(budget).filter(([,b]) => b > 0)
  const [modal, setModal] = useState<ModalState>({ mode: null, cat: '', val: '' })
  const [saving, setSaving] = useState(false)
  const [catSheet, setCatSheet] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const remaining = totalBudget - totalSpent
  function openEdit(cat: string, budg: number) { setModal({ mode: 'edit', cat, val: String(budg) }) }
  function openDelete(cat: string) { setModal({ mode: 'delete', cat, val: '' }) }
  function closeModal() { setModal({ mode: null, cat: '', val: '' }) }

  async function confirmAdd() {
    const val = parseFloat(modal.val)
    if (!modal.cat || isNaN(val) || val <= 0) { showStatus('⚠ Enter category and amount'); return }
    setSaving(true)
    try {
      await api.updateBudgetEntry(modal.cat, val)
      dispatch({ type:'SET_BUDGET', payload: { ...budget, [modal.cat]: val } })
      showStatus('✓ Budget saved')
      closeModal()
    } catch (e) { showStatus('⚠ ' + (e instanceof Error ? e.message : 'Save failed')) }
    finally { setSaving(false) }
  }

  async function confirmEdit() {
    const val = parseFloat(modal.val)
    if (isNaN(val) || val <= 0) { closeModal(); return }
    setSaving(true)
    try {
      await api.updateBudgetEntry(modal.cat, val)
      dispatch({ type:'SET_BUDGET', payload: { ...budget, [modal.cat]: val } })
      showStatus('✓ Budget updated')
      closeModal()
    } catch (e) { showStatus('⚠ ' + (e instanceof Error ? e.message : 'Save failed')) }
    finally { setSaving(false) }
  }

  async function confirmDelete() {
    setSaving(true)
    try {
      await api.deleteBudgetEntry(modal.cat)
      const nb = { ...budget }
      delete nb[modal.cat]
      dispatch({ type:'SET_BUDGET', payload: nb })
      showStatus('✓ Budget removed')
      closeModal()
    } catch (e) { showStatus('⚠ ' + (e instanceof Error ? e.message : 'Delete failed')) }
    finally { setSaving(false) }
  }

  return (
    <div className="pg">
      <UiSection
        title="Budget Management"
        icon={<Package size={14} />}
        right={undefined}
      />

      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi-card kpi-card--blue">
          <div className="kpi-card-l">Budget</div>
          <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>{INR(totalBudget)}</div>
        </div>
        <div className="kpi-card kpi-card--red">
          <div className="kpi-card-l">Spent</div>
          <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>{INR(totalSpent)}</div>
        </div>
        <div className={`kpi-card ${totalOver ? 'kpi-card--red' : 'kpi-card--green'}`}>
          <div className="kpi-card-l">{totalOver ? 'Over' : 'Remaining'}</div>
          <div className={`kpi-card-v kpi-card-v-soft ${totalOver ? 'kpi-card-v--red' : 'kpi-card-v--green'}`}>
            {totalOver ? '−' : ''}{INR(Math.abs(remaining))}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-card-l">Overspent</div>
          <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>{ovCount}</div>
        </div>
      </div>

      {/* Search */}
      <div style={{position:'relative',marginBottom:8}}>
        <input
          className="form-inp"
          style={{paddingRight:32,fontSize:14}}
          placeholder="Search categories..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="icon-btn" style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)'}}
            onClick={() => setSearch('')}><XIcon size={14} /></button>
        )}
      </div>

      <UiSection title="Categories" icon={<AlertTriangle size={14} />} />

      <div className="budget-list">
        {active.filter(([cat]) => cat.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>(cm[b[0]]||0)-(cm[a[0]]||0)).map(([cat, budg]) => {
          const spent = cm[cat] || 0
          const over = spent > budg
          const remaining = budg - spent
          const pct = budg > 0 ? (spent / budg) * 100 : 0
          const status = over ? 'OVER' : pct >= 90 ? 'CRITICAL' : pct >= 75 ? 'NEAR' : 'OK'
          const badgeClass = over ? 'budget-badge over' : pct >= 90 ? 'budget-badge critical' : pct >= 75 ? 'budget-badge near' : 'budget-badge ok'
          const col = over ? 'var(--rm)' : 'var(--text)'
          return (
            <div
              key={cat}
              className="card budget-row"
              onClick={() => setCatSheet(cat)}
            >
              <div className="budget-row-top">
                <div className="budget-row-cat" style={{color:'var(--text)'}}>
                  <CatIcon cat={cat} size={14} />{cat}
                </div>
                <div className="budget-row-actions">
                  <span className={badgeClass}>{status}</span>
                  <button className="icon-btn" onClick={(e) => {e.stopPropagation(); openEdit(cat, budg)}}><Pencil size={13} /></button>
                  <button className="icon-btn" style={{color:'var(--red)'}} onClick={(e) => {e.stopPropagation(); openDelete(cat)}}><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="budget-row-grid">
                <div>
                  <div className="budget-mini-lbl">Budget</div>
                  <div className="budget-mini-val">{INR(budg)}</div>
                </div>
                <div>
                  <div className="budget-mini-lbl">Spent</div>
                  <div className="budget-mini-val">{INR(spent)}</div>
                </div>
                <div className="budget-mini-right">
                  <div className="budget-mini-lbl">{over ? 'Over' : 'Left'}</div>
                  <div className="budget-mini-val" style={{ color: col }}>{INR(Math.abs(remaining))}</div>
                </div>
              </div>
            </div>
          )
        })}
        {!active.length && <div className="lb">No budget categories. Click "+ Add".</div>}
        {active.length > 0 && !active.filter(([cat]) => cat.toLowerCase().includes(search.toLowerCase())).length && <div className="lb">No matching categories.</div>}
      </div>

      {/* Modal */}
      <div className={`modal-bg ${modal.mode ? 'open' : ''}`} onClick={closeModal}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          {modal.mode === 'delete' ? (
            <>
              <div className="modal-hd">
                <span className="modal-title" style={{display:'flex',alignItems:'center',gap:6}}>
                  <AlertTriangle size={16} /> Remove Budget
                </span>
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
                <button className="btn btn-sm" style={{background:'var(--border)',color:'var(--text)'}} onClick={closeModal}><XIcon size={13} />Cancel</button>
                <button className="btn btn-sm" style={{background:'var(--red)',color:'#fff'}} onClick={confirmDelete} disabled={saving}>
                  <Trash2 size={13} />{saving ? '…' : 'Remove'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="modal-hd">
                <span className="modal-title" style={{display:'flex',alignItems:'center',gap:6}}>
                  {modal.mode === 'add' ? <><Plus size={15} />Add Budget</> : <><Pencil size={14} />Edit Budget</>}
                </span>
                <button className="modal-close" onClick={closeModal}><XIcon size={16} /></button>
              </div>
              <div className="modal-body">
                {modal.mode === 'add' ? (
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Category</div>
                    <select className="form-sel" value={modal.cat} onChange={e => setModal(m => ({...m, cat: e.target.value}))}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                ) : (
                  <div style={{fontSize:15,fontWeight:700,color:'var(--text)',display:'flex',alignItems:'center',gap:6}}>
                    <CatIcon cat={modal.cat} size={14} />{modal.cat}
                  </div>
                )}
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--muted)',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Budget Amount (₹)</div>
                  <input
                    className="form-inp" type="number" placeholder="0"
                    value={modal.val} autoFocus
                    onChange={e => setModal(m => ({...m, val: e.target.value}))}
                    onKeyDown={e => { if (e.key === 'Enter') { modal.mode === 'add' ? confirmAdd() : confirmEdit() } }}
                  />
                </div>
              </div>
              <div className="modal-foot">
                <div className="modal-foot-l" />
                <button className="btn btn-sm" style={{background:'var(--border)',color:'var(--text)'}} onClick={closeModal}><XIcon size={13} />Cancel</button>
                <button className="btn btn-sm btn-green" onClick={modal.mode === 'add' ? confirmAdd : confirmEdit} disabled={saving}>
                  <Check size={13} />{saving ? '…' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category Transaction Bottom Sheet */}
      {catSheet && (
        <div className={`modal-bg ${catSheet ? 'open' : ''}`} onClick={() => setCatSheet(null)} style={{position:'fixed',inset:0,zIndex:1000}}>
          <div className="sheet-panel" onClick={e => e.stopPropagation()}>
            <div className="sheet-hd">
              <h3 style={{fontSize:16,fontWeight:700,color:'var(--text)',margin:0,display:'flex',alignItems:'center',gap:6}}>
                <span style={{display:'flex',alignItems:'center',gap:6,color:decorColor(catSheet)}}>
                  <CatIcon cat={catSheet} size={15} />{catSheet}
                </span>
              </h3>
              <button className="modal-close" onClick={() => setCatSheet(null)} style={{padding:0}}><XIcon size={20} /></button>
            </div>

            <div className="sheet-stats" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
              <div className="card" style={{padding:'10px 12px'}}>
                <div className="lbl">Budget</div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginTop:4}}>{INR(budget[catSheet] || 0)}</div>
              </div>
              <div className="card" style={{padding:'10px 12px'}}>
                <div className="lbl">Spent</div>
                <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginTop:4}}>{INR(cm[catSheet] || 0)}</div>
              </div>
              <div className="card" style={{padding:'10px 12px',background:(cm[catSheet] || 0) > (budget[catSheet] || 0)?'rgba(239,68,68,.08)':'rgba(34,197,94,.08)'}}>
                <div className="lbl">{(cm[catSheet] || 0) > (budget[catSheet] || 0)?'Over':'Left'}</div>
                <div style={{fontSize:14,fontWeight:700,color:(cm[catSheet] || 0) > (budget[catSheet] || 0)?'var(--rm)':'var(--gm)',marginTop:4}}>
                  {INR(Math.abs((budget[catSheet] || 0) - (cm[catSheet] || 0)))}
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
                        <div style={{fontWeight:700,fontSize:14,color:'var(--rm)'}}>{INR(txn.a)}</div>
                        <div style={{fontSize:10,color:'var(--muted)',marginTop:1}}>{txn.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

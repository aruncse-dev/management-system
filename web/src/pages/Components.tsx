import { useState } from 'react'
import { Activity, BarChart3, ChartPie, LayoutGrid, Settings, Shield, CreditCard, Plus, PencilLine, Wallet, TrendingUp, AlertTriangle, CalendarDays, Landmark, IndianRupee } from 'lucide-react'
import { BalanceRow, Chip, FilterPills, FormField, InfoCallout, InternalTabBar, KpiCard, ModalActions, ModalShell, SearchField, SectionBlock, SectionTitle, TabBar, TransactionRow, UiPill } from '../ui-kit'
import '../ui-kit/ui-kit.css'

const DONUT = [
  { label: 'Groceries', value: 4200, color: '#2563EB' },
  { label: 'Rent', value: 12500, color: '#DC2626' },
  { label: 'Travel', value: 3200, color: '#0891B2' },
  { label: 'Education', value: 1800, color: '#F59E0B' },
]

const TABS = [
  { id: 'overview', label: 'Overview', icon: <LayoutGrid size={16} /> },
  { id: 'cards', label: 'Cards', icon: <CreditCard size={16} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 size={16} /> },
  { id: 'history', label: 'History', icon: <Activity size={16} /> },
  { id: 'more', label: 'More', icon: <Shield size={16} /> },
]

export default function Components() {
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [modalDraft, setModalDraft] = useState({
    title: '',
    amount: '',
    note: '',
    account: 'Arun IB',
  })
  const [internalTab, setInternalTab] = useState('entries')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [navActive, setNavActive] = useState('overview')

  function openAdd() {
    setModalDraft({ title: '', amount: '', note: '', account: 'Arun IB' })
    setModalMode('add')
  }

  function openEdit() {
    setModalDraft({
      title: 'Salary credit',
      amount: '₹84,000',
      note: 'Prefilled from existing item',
      account: 'Amma IB',
    })
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setModalDraft({ title: '', amount: '', note: '', account: 'Arun IB' })
  }
  return (
    <div className="pg ui-page">
      <SectionTitle
        title="UI Kit"
        icon={<Shield size={14} />}
        right={<UiPill tone="navy">Preview</UiPill>}
      />

      <SectionBlock title="Nav surface" icon={<LayoutGrid size={14} />} right={<UiPill tone="muted">6 tabs</UiPill>}>
        <div className="ui-stack">
          <TabBar
            tabs={TABS}
            active={navActive}
            onChange={setNavActive}
          />
          <InfoCallout title={`Dummy action: ${navActive}`} tone="muted">
            This matches the Dashboard/monthly tab style.
          </InfoCallout>
        </div>
      </SectionBlock>

      <SectionBlock title="KPI surface" icon={<Wallet size={14} />} right={<UiPill tone="muted">Icons + no icons</UiPill>}>
        <div className="dash-grid">
          <KpiCard label="Plain KPI" value="₹1,28,500" tone="navy" subtitle="No icon version" />
          <KpiCard label="Net Balance" value="₹1,28,500" tone="green" icon={<Wallet size={14} />} subtitle="Current net position" />
          <KpiCard label="Cashflow" value="₹24,900" tone="navy" icon={<TrendingUp size={14} />} subtitle="Monthly movement" />
          <KpiCard label="Outstanding" value="₹8,250" tone="red" icon={<AlertTriangle size={14} />} subtitle="Needs attention" />
          <KpiCard label="Budget" value="₹4,250" tone="amber" icon={<CalendarDays size={14} />} subtitle="Left for month" />
          <KpiCard label="Full KPI" value="₹2,40,000" tone="navy" full icon={<Shield size={14} />} subtitle="Spans the full row" />
        </div>
      </SectionBlock>

      <SectionBlock title="Chart surface" icon={<ChartPie size={14} />} right={<UiPill tone="muted">Dashboard</UiPill>}>
        <div className="ui-kit-chart-grid">
          <AreaChartPanel />
          <BarsChartPanel />
          <MiniDonut />
        </div>
      </SectionBlock>

      <SectionBlock title="Form surface" icon={<Activity size={14} />}>
        <div className="ui-stack">
          <FormField label="Title">
            <input className="form-inp" type="text" placeholder="Add transaction title" />
          </FormField>
          <FormField label="Amount">
            <input className="form-inp" type="number" placeholder="₹0" />
          </FormField>
        </div>
      </SectionBlock>

      <SectionBlock title="Transaction surface" icon={<CreditCard size={14} />} right={<UiPill tone="muted">Rows</UiPill>}>
        <div className="ui-stack">
          <TransactionRow
            title="Groceries at Reliance"
            amount="−₹1,240"
            date="12 Mar 2026"
            category="Food"
            type="Expense"
            mode="UPI"
            tone="red"
            icon={<CalendarDays size={12} />}
            trailing={<Chip tone="red">Bill</Chip>}
          />
          <TransactionRow
            title="Salary Credit"
            amount="+₹84,000"
            date="01 Mar 2026"
            category="Income"
            type="Income"
            mode="Bank"
            tone="green"
            icon={<TrendingUp size={12} />}
            trailing={<Chip tone="green">Salary</Chip>}
          />
        </div>
      </SectionBlock>

      <SectionBlock title="Search & filters" icon={<Activity size={14} />} right={<UiPill tone="muted">Shared controls</UiPill>}>
        <div className="ui-stack">
          <SearchField value={search} placeholder="Search items..." onChange={setSearch} onClear={() => setSearch('')} />
          <FilterPills items={['All', 'Income', 'Expense', 'Transfer']} active={filter} onChange={setFilter} />
        </div>
      </SectionBlock>

      <SectionBlock title="Internal tabs" icon={<LayoutGrid size={14} />} right={<UiPill tone="muted">Grouped content</UiPill>}>
        <div className="ui-stack">
          <InternalTabBar
            tabs={[
              { id: 'entries', label: 'Entries' },
              { id: 'summary', label: 'Summary' },
              { id: 'history', label: 'History' },
            ]}
            active={internalTab}
            onChange={setInternalTab}
          />
          {internalTab === 'entries' && (
            <div className="ui-stack">
              <TransactionRow
                title="Phone bill"
                amount="−₹980"
                date="18 Mar 2026"
                category="Utilities"
                type="Expense"
                mode="UPI"
                tone="red"
              />
            </div>
          )}
          {internalTab === 'summary' && (
            <div className="dash-grid">
              <KpiCard label="Income" value="₹84,000" tone="green" subtitle="This month" />
              <KpiCard label="Expense" value="₹55,100" tone="red" subtitle="This month" />
            </div>
          )}
          {internalTab === 'history' && (
            <InfoCallout title="No new entries" tone="muted">
              This section stays compact and scroll-safe for mobile detail views.
            </InfoCallout>
          )}
        </div>
      </SectionBlock>

      <SectionBlock title="Overview cards" icon={<BarChart3 size={14} />}>
        <div className="dash-grid">
          <KpiCard label="Balance" value="₹1,28,500" tone="navy" />
          <KpiCard label="Income" value="₹84,000" tone="green" icon={<TrendingUp size={14} />} />
          <KpiCard label="Spent" value="₹55,100" tone="red" />
        </div>
      </SectionBlock>

      <SectionBlock title="Balance rows" icon={<Wallet size={14} />} right={<UiPill tone="muted">Income / spent</UiPill>}>
        <div className="ui-stack">
          <BalanceRow
            title="Arun IB"
            value="₹48,500"
            income="₹18,500"
            expense="₹7,200"
          />
          <BalanceRow
            title="Cash"
            value="₹12,200"
            income="₹4,200"
            expense="₹9,100"
          />
        </div>
      </SectionBlock>

      <SectionBlock title="Loan categories" icon={<Landmark size={14} />} right={<UiPill tone="muted">Cash / Jewel</UiPill>}>
        <div className="ui-stack">
          <SectionTitle title="Cash Loan" icon={<Wallet size={14} />} right={<UiPill tone="green">Active</UiPill>} />
          <div className="ui-kit-sheet-row">
            <Chip tone="navy">Person</Chip>
            <Chip tone="amber">Received</Chip>
            <Chip tone="red">Outstanding</Chip>
            <Chip tone="muted">Payments</Chip>
          </div>

          <SectionTitle title="Jewel Loan" icon={<Shield size={14} />} right={<UiPill tone="amber">Collateral</UiPill>} />
          <div className="ui-kit-sheet-row">
            <Chip tone="navy">Ornaments</Chip>
            <Chip tone="green">Ongoing</Chip>
            <Chip tone="red">Closed</Chip>
            <Chip tone="muted">History</Chip>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Investment section" icon={<TrendingUp size={14} />} right={<UiPill tone="navy">Dashboard</UiPill>}>
        <div className="ui-stack">
          <SectionTitle title="Stocks" icon={<TrendingUp size={14} />} right={<UiPill tone="green">Live</UiPill>} />
          <div className="dash-grid">
            <KpiCard label="Invested" value="₹1,24,000" tone="muted" subtitle="Total buy cost" />
            <KpiCard label="Current" value="₹1,39,600" tone="navy" subtitle="Latest value" />
            <KpiCard label="P&L" value="+₹15,600" tone="green" subtitle="Gain so far" />
            <KpiCard label="Holdings" value="8" tone="amber" subtitle="Tracked stocks" />
          </div>

          <SectionTitle title="Mutual Funds" icon={<ChartPie size={14} />} right={<UiPill tone="amber">Allocated</UiPill>} />
          <div className="dash-grid">
            <KpiCard label="Invested" value="₹76,500" tone="muted" subtitle="SIP + lumpsum" />
            <KpiCard label="Current" value="₹82,950" tone="navy" subtitle="Market value" />
            <KpiCard label="P&L" value="+₹6,450" tone="green" subtitle="Overall growth" />
            <KpiCard label="Schemes" value="5" tone="amber" subtitle="Active funds" />
          </div>

          <TransactionRow
            title="HDFC Bank"
            amount="+₹2,450"
            date="22 Mar 2026"
            category="Stocks"
            type="Dividend"
            mode={<UiPill tone="green">Cash</UiPill>}
            tone="green"
            icon={<IndianRupee size={12} />}
            trailing={<Chip tone="green">Credit</Chip>}
          />
        </div>
      </SectionBlock>

      <SectionBlock title="Modal surface" icon={<Shield size={14} />} right={<UiPill tone="muted">Actions</UiPill>}>
        <div className="settings-actions">
          <button type="button" className="settings-action-btn" onClick={openAdd}>
            <Plus size={14} /> Add
          </button>
          <button type="button" className="settings-action-btn" onClick={openEdit}>
            <PencilLine size={14} /> Edit
          </button>
        </div>
      </SectionBlock>

      {modalMode && (
        <ModalShell
          title={modalMode === 'add' ? 'Add Transaction' : 'Edit Transaction'}
          onClose={closeModal}
          footer={
            <ModalActions
              secondaryLabel="Cancel"
              primaryLabel={modalMode === 'edit' ? 'Save' : 'Add'}
              destructive={false}
              leading={modalMode === 'edit' ? (
                <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={closeModal}>
                  Delete
                </button>
              ) : null}
              onSecondary={closeModal}
              onPrimary={closeModal}
            />
          }
        >
          <div className="ui-stack">
            <FormField label="Title">
              <input className="form-inp" type="text" placeholder="Add transaction title" value={modalDraft.title} onChange={e => setModalDraft(d => ({ ...d, title: e.target.value }))} />
            </FormField>
            <FormField label="Amount">
              <input className="form-inp" type="text" placeholder="₹0" value={modalDraft.amount} onChange={e => setModalDraft(d => ({ ...d, amount: e.target.value }))} />
            </FormField>
            <FormField label="Account">
              <input className="form-inp" type="text" placeholder="Arun IB" value={modalDraft.account} onChange={e => setModalDraft(d => ({ ...d, account: e.target.value }))} />
            </FormField>
            <FormField label="Note">
              <input className="form-inp" type="text" placeholder="Optional note" value={modalDraft.note} onChange={e => setModalDraft(d => ({ ...d, note: e.target.value }))} />
            </FormField>
          </div>
        </ModalShell>
      )}

    </div>
  )
}

function MiniDonut() {
  return (
    <div className="ui-kit-mini-chart ui-kit-mini-chart--donut">
      <PreviewDonut items={DONUT} />
    </div>
  )
}

function AreaChartPanel() {
  return (
    <div className="ui-kit-chart-panel">
      <div>
        <div className="ui-kit-chart-label">Net cashflow</div>
        <div className="ui-kit-chart-value" style={{ color: 'var(--gm)' }}>+₹24.9k</div>
      </div>
      <svg viewBox="0 0 180 96" className="ui-kit-svg-chart" aria-label="Cashflow area chart">
        <defs>
          <linearGradient id="cashflowFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22C55E" stopOpacity=".35" />
            <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          fill="url(#cashflowFill)"
          stroke="none"
          points="4,70 28,56 52,61 76,38 100,44 124,24 148,30 176,14 176,92 4,92"
        />
        <polyline
          fill="none"
          stroke="var(--gm)"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          points="4,70 28,56 52,61 76,38 100,44 124,24 148,30 176,14"
        />
      </svg>
      <div className="ui-kit-chart-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Mar 1</span>
        <span>Mar 31</span>
      </div>
    </div>
  )
}

function BarsChartPanel() {
  const bars = [32, 58, 46, 71, 40, 62]
  return (
    <div className="ui-kit-chart-panel">
        <div>
          <div className="ui-kit-chart-label">Expense buckets</div>
          <div className="ui-kit-chart-value" style={{ color: 'var(--rm)' }}>₹18.2k</div>
        </div>
        <svg viewBox="0 0 180 96" className="ui-kit-svg-chart" aria-label="Expense bar chart">
          {bars.map((v, i) => (
            <rect
              key={i}
              x={12 + i * 27}
              y={92 - v}
              width="14"
              height={v}
              rx="5"
              fill={['#2563EB', '#22C55E', '#F59E0B', '#EF4444', '#0EA5E9', '#8B5CF6'][i]}
            />
          ))}
        </svg>
      <div className="ui-kit-chart-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Food</span>
        <span>Travel</span>
      </div>
    </div>
  )
}

function PreviewDonut({ items }: { items: typeof DONUT }) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  let cursor = 0
  const size = 118
  const center = 59
  const radius = 42
  const stroke = 14

  return (
    <div className="chart-donut chart-donut--side">
      <div className="chart-donut-layout chart-donut-layout--side is-compact">
        <svg width={size} height={size} viewBox="0 0 118 118" className="chart-donut-surface is-compact">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
          {items.map(item => {
            const pct = total > 0 ? item.value / total : 1 / Math.max(1, items.length)
            const dash = 2 * Math.PI * radius * pct
            const offset = 2 * Math.PI * radius * cursor
            cursor += pct
            return (
              <circle
                key={item.label}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${2 * Math.PI * radius - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${center} ${center})`}
              />
            )
          })}
          <text x={center} y={center - 5} textAnchor="middle" fontSize={9} fill="var(--muted)" fontWeight={600}>NET</text>
          <text x={center} y={center + 10} textAnchor="middle" fontSize={11} fill="var(--text)" fontWeight={700}>₹21.7k</text>
        </svg>

        <div className="chart-donut-legend chart-donut-legend--side">
          {items.map(item => {
            const pct = total > 0 ? (item.value / total) * 100 : 0
            return (
              <div key={item.label} className="chart-donut-legend-item chart-donut-legend-item--side is-compact">
                <div className="chart-donut-dot" style={{ background: item.color }} />
                <span className="chart-donut-label">{item.label}</span>
                <div className="chart-donut-meta">
                  <span className="chart-donut-pct chart-donut-pct--side">{pct.toFixed(0)}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

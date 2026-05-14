import { useState, useCallback } from 'react'
import { BarChart3, ChartPie, CreditCard, LayoutGrid, PencilLine, Plus, Shield, TrendingUp, Wallet } from 'lucide-react'
import {
  BalanceRow,
  FilterChips,
  FilterPills,
  FormField,
  HoldingCard,
  HoldingModal,
  InfoCallout,
  InternalTabBar,
  KpiCard,
  KpiGrid,
  ModalActions,
  ModalShell,
  SearchField,
  SectionBlock,
  SectionChip,
  SectionTitle,
  Spacer,
} from '../ui'
import { RightLegendDonut } from '../ui'
import { useMoneyFormatting } from '../hooks/useFormatMoney'

const DONUT = [
  { label: 'Savings', value: 29300, color: '#2563EB' },
  { label: 'Loans', value: 18400, color: '#DC2626' },
  { label: 'Investments', value: 12150, color: '#0891B2' },
  { label: 'Gold', value: 8700, color: '#F59E0B' },
]

const TABS = [
  { id: 'overview', label: 'Overview', icon: <LayoutGrid size={16} /> },
  { id: 'activity', label: 'Activity', icon: <CreditCard size={16} /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 size={16} /> },
  { id: 'history', label: 'History', icon: <Wallet size={16} /> },
]

export default function Components() {
  const { format: fmt, zeroPlaceholder } = useMoneyFormatting()
  const donutFmt = useCallback((value: number) => fmt(Math.round(value)), [fmt])
  const [navActive, setNavActive] = useState('overview')
  const [filter, setFilter] = useState('All')
  const [filterChip, setFilterChip] = useState('All')
  const [internalTab, setInternalTab] = useState('entries')
  const [search, setSearch] = useState('')
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [holdingModal, setHoldingModal] = useState(false)

  return (
    <div className="ui-kit-page-shell components-page">
      <div className="pg components-page">
      <Spacer size={16} />
      <SectionTitle
        title="UI Kit"
        subtitle="Component library & patterns"
        icon={<Shield size={13} />}
        right={<SectionChip>Preview</SectionChip>}
      />
      <Spacer size={16} />

      <div style={{ display: 'grid', gap: 16 }}>
      <SectionBlock title="Section styles" icon={<Shield size={13} />} rightChip={<SectionChip>Titles</SectionChip>}>
        <div className="ui-stack">
          <SectionTitle
            title="Primary title"
            subtitle="A compact heading with supporting text."
            icon={<Shield size={13} />}
            right={<SectionChip>Action</SectionChip>}
          />
          <InfoCallout title="Reusable callout" tone="muted">
            Shared helper blocks should live here once, instead of being repeated on every screen.
          </InfoCallout>
        </div>
      </SectionBlock>

      <SectionBlock title="Navigation" icon={<LayoutGrid size={13} />} right={<SectionChip>Tabs</SectionChip>}>
        <div className="ui-stack">
          <nav className="bottom-nav">
            {TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`bottom-nav-item${navActive === tab.id ? ' active' : ''}`}
                onClick={() => setNavActive(tab.id)}
              >
                <span className="bottom-nav-icon">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
          <div className="pills">
            {['entries', 'summary', 'notes'].map(tab => (
              <button
                key={tab}
                type="button"
                className={`pill ${internalTab === tab ? 'active' : ''}`}
                onClick={() => setInternalTab(tab)}
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Metrics" icon={<Wallet size={13} />} rightChip={<SectionChip>KPIs</SectionChip>}>
        <KpiGrid>
          <KpiCard label="Balance" value={fmt(128500)} tone="navy" icon={<Wallet size={13} />} />
          <KpiCard label="Savings" value={fmt(29300)} tone="green" icon={<TrendingUp size={13} />} />
          <KpiCard label="Loans" value={fmt(18400)} tone="red" icon={<CreditCard size={13} />} />
          <KpiCard label="Invested" value={fmt(12150)} tone="amber" icon={<BarChart3 size={13} />} />
        </KpiGrid>
      </SectionBlock>

      <SectionBlock title="Summary Chart" icon={<ChartPie size={13} />} right={<SectionChip>Donut</SectionChip>}>
        <div className="ui-stack">
          <div className="ui-kit-card" style={{ padding: 12 }}>
            <RightLegendDonut
              items={DONUT}
              compact
              showCenter
              centerLabel="NET WORTH"
              centerValue={fmt(68600)}
              valueFormatter={donutFmt}
            />
          </div>
          <div className="ui-kit-card" style={{ padding: 12 }}>
            <RightLegendDonut
              items={DONUT}
              compact
              showPct={false}
              showCenter
              centerLabel="NET WORTH"
              centerValue={fmt(68600)}
              legendPosition="bottom"
              valueFormatter={donutFmt}
            />
          </div>
          <div className="ui-kit-card" style={{ padding: 12 }}>
            <RightLegendDonut
              items={DONUT}
              compact
              showCenter
              centerLabel="NET WORTH"
              centerValue={fmt(68600)}
              showLegend={false}
              valueFormatter={donutFmt}
            />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Inputs and filters" icon={<Wallet size={14} />} right={<SectionChip>Controls</SectionChip>}>
        <div className="ui-stack">
          <FormField label="Search">
            <SearchField value={search} placeholder="Search items..." onChange={setSearch} onClear={() => setSearch('')} />
          </FormField>
          <FilterPills items={['All', 'Income', 'Expense', 'Transfer']} active={filter} onChange={setFilter} />
          <FilterChips items={['All', 'Savings', 'Loans', 'Gold', 'MF']} active={filterChip} onChange={setFilterChip} />
        </div>
      </SectionBlock>

      <SectionBlock title="Rows" icon={<CreditCard size={13} />} rightChip={<SectionChip>Entries</SectionChip>}>
        <div className="ui-stack">
          <HoldingCard
            title="Nestack"
            subtitle="Amma SBI"
            leftLabel="Amount"
            leftValue={`+${fmt(30000)}`}
            centerLabel="Type"
            centerValue="Income"
            rightLabel="Date"
            rightValue="07-Apr-26"
            accentTone="green"
            icon={<TrendingUp size={13} />}
            iconPosition="right"
            iconBackground
            className="lending-entry-card"
            onClick={() => {}}
          />
          <BalanceRow title="Arun IB" value={fmt(48500)} income={fmt(18500)} expense={fmt(7200)} />
        </div>
      </SectionBlock>

      <SectionBlock title="Holding cards" icon={<TrendingUp size={13} />} rightChip={<SectionChip>2 items</SectionChip>}>
        <div className="ui-stack">
          <HoldingCard
            title="INFY"
            subtitle="Infosys Limited"
            leftLabel="QTY"
            leftValue="50"
            centerLabel="INVESTED"
            centerValue={fmt(36000)}
            rightLabel="CURRENT"
            rightValue={fmt(41500)}
            pnlLabel="PROFIT"
            pnlValue={`+${fmt(5500)}`}
            accentTone="green"
            onClick={() => setHoldingModal(true)}
          />
          <InfoCallout title="Loan preview" tone="amber">
            All Loans uses the same action language, but the data shape is different from equity holdings.
          </InfoCallout>
        </div>
      </SectionBlock>

      <SectionBlock title="Actions" icon={<PencilLine size={13} />} right={<SectionChip>Modal</SectionChip>}>
        <div className="settings-actions">
          <button type="button" className="ui-kit-btn ui-kit-btn--soft" onClick={() => setModalMode('add')}>
            <Plus size={14} /> Add
          </button>
          <button
            type="button"
            className="ui-kit-btn"
            onClick={() => setModalMode('edit')}
            style={{
              background: 'rgba(255,255,255,.18)',
              color: 'var(--text)',
              border: '1px solid rgba(255,255,255,.32)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <PencilLine size={14} /> Edit
          </button>
        </div>
      </SectionBlock>

      {modalMode && (
        <ModalShell
          title={modalMode === 'add' ? 'Add Transaction' : 'Edit Transaction'}
          onClose={() => setModalMode(null)}
          footer={
            <ModalActions
              secondaryLabel="Cancel"
              primaryLabel={modalMode === 'edit' ? 'Save' : 'Add'}
              leading={
                modalMode === 'edit' ? (
                  <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={() => setModalMode(null)}>
                    Delete
                  </button>
                ) : null
              }
              onSecondary={() => setModalMode(null)}
              onPrimary={() => setModalMode(null)}
            />
          }
        >
          <div className="ui-stack">
            <FormField label="Title">
              <input className="form-inp" type="text" placeholder="Add transaction title" />
            </FormField>
            <FormField label="Amount">
              <input className="form-inp" type="text" placeholder={zeroPlaceholder} />
            </FormField>
            <FormField label="Note">
              <input className="form-inp" type="text" placeholder="Optional note" />
            </FormField>
          </div>
        </ModalShell>
      )}

      {holdingModal && (
        <HoldingModal
          title="INFY"
          onClose={() => setHoldingModal(false)}
          pnlLabel="Profit"
          pnlValue={`+${fmt(5500)}`}
          pnlPct="(+15.3%)"
          accentTone="green"
        >
          <div className="ui-kit-holding-detail">
            <div className="ui-kit-holding-detail-label">ISIN</div>
            <div className="ui-kit-holding-detail-value">INE009A01021</div>
          </div>
          <div className="ui-kit-holding-detail">
            <div className="ui-kit-holding-detail-label">Avg Price</div>
            <div className="ui-kit-holding-detail-value">{fmt(720)}</div>
          </div>
          <div className="ui-kit-holding-detail">
            <div className="ui-kit-holding-detail-label">CMP</div>
            <div className="ui-kit-holding-detail-value">{fmt(830)}</div>
          </div>
        </HoldingModal>
      )}
      </div>
      <Spacer size={20} />
      </div>
    </div>
  )
}

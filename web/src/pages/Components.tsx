import { useState } from 'react'
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
  ModalActions,
  ModalShell,
  SearchField,
  SectionBlock,
  SectionChip,
  SectionTitle,
  Spacer,
  TabBar,
  UiPill,
} from '../ui-kit'
import { RightLegendDonut } from '../components/RightLegendDonut'

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
  const [navActive, setNavActive] = useState('overview')
  const [filter, setFilter] = useState('All')
  const [filterChip, setFilterChip] = useState('All')
  const [internalTab, setInternalTab] = useState('entries')
  const [search, setSearch] = useState('')
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [holdingModal, setHoldingModal] = useState(false)

  return (
    <div className="ui-kit-page-shell components-page">
      <Spacer size={16} />
      <SectionTitle
        title="UI Kit"
        subtitle="Component library & patterns"
        icon={<Shield size={13} />}
        right={<UiPill tone="navy">Preview</UiPill>}
      />
      <Spacer size={16} />

      <div style={{ display: 'grid', gap: 16 }}>
      <SectionBlock title="Section styles" icon={<Shield size={13} />} rightChip={<SectionChip tone="muted">Titles</SectionChip>}>
        <div className="ui-stack">
          <SectionTitle
            title="Primary title"
            subtitle="A compact heading with supporting text."
            icon={<Shield size={13} />}
            right={<UiPill tone="navy">Action</UiPill>}
          />
          <InfoCallout title="Reusable callout" tone="muted">
            Shared helper blocks should live here once, instead of being repeated on every screen.
          </InfoCallout>
        </div>
      </SectionBlock>

      <SectionBlock title="Navigation" icon={<LayoutGrid size={13} />} right={<SectionChip tone="muted">Tabs</SectionChip>}>
        <div className="ui-stack">
          <TabBar tabs={TABS} active={navActive} onChange={setNavActive} />
          <InternalTabBar
            tabs={[
              { id: 'entries', label: 'Entries' },
              { id: 'summary', label: 'Summary' },
              { id: 'notes', label: 'Notes' },
            ]}
            active={internalTab}
            onChange={setInternalTab}
          />
        </div>
      </SectionBlock>

      <SectionBlock title="Metrics" icon={<Wallet size={13} />} rightChip={<SectionChip tone="green">KPIs</SectionChip>}>
        <div className="dash-grid">
          <KpiCard label="Balance" value="₹1,28,500" tone="navy" icon={<Wallet size={13} />} />
          <KpiCard label="Savings" value="₹29,300" tone="green" icon={<TrendingUp size={13} />} />
          <KpiCard label="Loans" value="₹18,400" tone="red" icon={<CreditCard size={13} />} />
          <KpiCard label="Invested" value="₹12,150" tone="amber" icon={<BarChart3 size={13} />} />
        </div>
      </SectionBlock>

      <SectionBlock title="Summary Chart" icon={<ChartPie size={13} />} right={<UiPill tone="navy">Donut</UiPill>}>
        <div className="ui-stack">
          <div className="ui-kit-card" style={{ padding: 12 }}>
            <RightLegendDonut
              items={DONUT}
              compact
              showCenter
              centerLabel="NET WORTH"
              centerValue="₹68.6k"
              valueFormatter={(value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`}
            />
          </div>
          <div className="ui-kit-card" style={{ padding: 12 }}>
            <RightLegendDonut
              items={DONUT}
              compact
              showPct={false}
              showCenter
              centerLabel="NET WORTH"
              centerValue="₹68.6k"
              legendPosition="bottom"
              valueFormatter={(value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`}
            />
          </div>
          <div className="ui-kit-card" style={{ padding: 12 }}>
            <RightLegendDonut
              items={DONUT}
              compact
              showCenter
              centerLabel="NET WORTH"
              centerValue="₹68.6k"
              showLegend={false}
              valueFormatter={(value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`}
            />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Inputs and filters" icon={<Wallet size={14} />} right={<UiPill tone="muted">Controls</UiPill>}>
        <div className="ui-stack">
          <FormField label="Search">
            <SearchField value={search} placeholder="Search items..." onChange={setSearch} onClear={() => setSearch('')} />
          </FormField>
          <FilterPills items={['All', 'Income', 'Expense', 'Transfer']} active={filter} onChange={setFilter} />
          <FilterChips items={['All', 'Savings', 'Loans', 'Gold', 'MF']} active={filterChip} onChange={setFilterChip} />
        </div>
      </SectionBlock>

      <SectionBlock title="Rows" icon={<CreditCard size={13} />} rightChip={<SectionChip tone="muted">Entries</SectionChip>}>
        <div className="ui-stack">
          <HoldingCard
            title="Nestack"
            subtitle="Amma SBI"
            leftLabel="Amount"
            leftValue="+₹30,000"
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
          <BalanceRow title="Arun IB" value="₹48,500" income="₹18,500" expense="₹7,200" />
        </div>
      </SectionBlock>

      <SectionBlock title="Holding cards" icon={<TrendingUp size={13} />} rightChip={<SectionChip tone="green">2 items</SectionChip>}>
        <div className="ui-stack">
          <HoldingCard
            title="INFY"
            subtitle="Infosys Limited"
            leftLabel="QTY"
            leftValue="50"
            centerLabel="INVESTED"
            centerValue="₹36,000"
            rightLabel="CURRENT"
            rightValue="₹41,500"
            pnlLabel="PROFIT"
            pnlValue="+₹5,500"
            accentTone="green"
            onClick={() => setHoldingModal(true)}
          />
          <InfoCallout title="Loan preview" tone="amber">
            All Loans uses the same action language, but the data shape is different from equity holdings.
          </InfoCallout>
        </div>
      </SectionBlock>

      <SectionBlock title="Actions" icon={<PencilLine size={13} />} right={<UiPill tone="muted">Modal</UiPill>}>
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
              <input className="form-inp" type="text" placeholder="₹0" />
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
          pnlValue="+₹5,500"
          pnlPct="(+15.3%)"
          accentTone="green"
        >
          <div className="ui-kit-holding-detail">
            <div className="ui-kit-holding-detail-label">ISIN</div>
            <div className="ui-kit-holding-detail-value">INE009A01021</div>
          </div>
          <div className="ui-kit-holding-detail">
            <div className="ui-kit-holding-detail-label">Avg Price</div>
            <div className="ui-kit-holding-detail-value">₹720</div>
          </div>
          <div className="ui-kit-holding-detail">
            <div className="ui-kit-holding-detail-label">CMP</div>
            <div className="ui-kit-holding-detail-value">₹830</div>
          </div>
        </HoldingModal>
      )}
      </div>
      <Spacer size={20} />
    </div>
  )
}

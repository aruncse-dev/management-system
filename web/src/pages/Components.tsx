import { Activity, ChartPie, LayoutGrid, Shield, Wallet } from 'lucide-react'
import { RightLegendDonut } from '../components/RightLegendDonut'
import { UiHero, UiMetric, UiPanel, UiPill, UiSection } from '../components/FinanceUI'

const DONUT = [
  { label: 'Groceries', value: 4200, color: '#2563EB' },
  { label: 'Rent', value: 12500, color: '#DC2626' },
  { label: 'Travel', value: 3200, color: '#0891B2' },
  { label: 'Education', value: 1800, color: '#F59E0B' },
]

export default function Components() {
  return (
    <div className="pg ui-page">
      <UiHero
        eyebrow="Shared UI"
        title="Components Reference"
        subtitle="A single place to preview the card, chip, and chart styles used across the app."
        right={<UiPill tone="navy">Preview</UiPill>}
      >
        <div className="ui-hero-kpis">
          <UiPill tone="green">Income</UiPill>
          <UiPill tone="red">Expense</UiPill>
          <UiPill tone="amber">Budget</UiPill>
          <UiPill tone="muted">Neutral</UiPill>
        </div>
      </UiHero>

      <div className="dash-grid">
        <UiMetric label="Current balance" value="₹1,28,500" hint="Example hero card" icon={<Wallet size={16} />} tone="green" />
        <UiMetric label="Overspent" value="₹4,250" hint="Example alert card" icon={<Shield size={16} />} tone="red" />
        <UiMetric label="Top spend" value="₹12,500" hint="Example spend tile" icon={<Activity size={16} />} tone="amber" />
        <UiMetric label="View mode" value="Compact" hint="Reusable layout block" icon={<LayoutGrid size={16} />} tone="navy" />
      </div>

      <UiSection
        title="Preview blocks"
        subtitle="Keep these patterns consistent when building new financial pages."
      />

      <UiPanel
        title="Pills and labels"
        subtitle="Use these for filters, status, and short callouts."
        icon={<Activity size={16} />}
        right={<UiPill tone="green">Active</UiPill>}
      >
        <div className="ui-pill-row">
          <UiPill tone="navy">Income</UiPill>
          <UiPill tone="red">Over budget</UiPill>
          <UiPill tone="amber">Near limit</UiPill>
          <UiPill tone="muted">Info</UiPill>
        </div>
      </UiPanel>

      <div className="ui-two-col">
        <UiPanel
          title="Donut layout"
          subtitle="This is the preferred chart pattern for monthly breakdowns."
          icon={<ChartPie size={16} />}
        >
          <RightLegendDonut
            items={DONUT}
            showCenter
            centerLabel="SPENT"
            centerValue="₹21,700"
            legendPosition="bottom"
          />
        </UiPanel>

        <UiPanel
          title="Card stack"
          subtitle="Use a consistent card surface for summaries and warnings."
          icon={<Shield size={16} />}
        >
          <div className="ui-stack">
            <div className="ui-mini-card ui-mini-card-green">
              <div className="ui-mini-title">Positive</div>
              <div className="ui-mini-value">₹18,400 left</div>
            </div>
            <div className="ui-mini-card ui-mini-card-red">
              <div className="ui-mini-title">Warning</div>
              <div className="ui-mini-value">₹4,250 overspent</div>
            </div>
          </div>
        </UiPanel>
      </div>

      <UiPanel
        title="Bottom sheet"
        subtitle="Use this for drill-down details and source breakdowns."
        icon={<LayoutGrid size={16} />}
        right={<UiPill tone="muted">Sheet shell</UiPill>}
      >
        <div className="ui-stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div className="kpi-card-l" style={{ marginBottom: 4 }}>Credit Details</div>
              <div className="dash-credit-summary-sub">Card and other credit sources</div>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</div>
          </div>
          <div className="dash-credit-out-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div className="kpi-card kpi-card--gray dash-credit-out-card">
              <div className="kpi-card-l">HDFC</div>
              <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>−₹12,400</div>
            </div>
            <div className="kpi-card kpi-card--gray dash-credit-out-card">
              <div className="kpi-card-l">Axis</div>
              <div className="kpi-card-v kpi-card-v-soft" style={{ color: '#111827' }}>−₹8,250</div>
            </div>
          </div>
        </div>
      </UiPanel>
    </div>
  )
}

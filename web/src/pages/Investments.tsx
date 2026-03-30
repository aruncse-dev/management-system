import { useEffect, useMemo, useState } from 'react';
import { BarChart3, LayoutDashboard, Loader2, PieChart, RefreshCw, TrendingUp, type LucideIcon } from 'lucide-react';
import { api, type RawHolding } from '../api';
import Stocks from './Stocks';
import MutualFunds from './MutualFunds';

type InvestmentTab = 'dashboard' | 'stocks' | 'mutualFunds';

type HoldingsGroup = {
  stocks: RawHolding[];
  mutualFunds: RawHolding[];
};

type DashboardCache = {
  hasToken: boolean;
  data: HoldingsGroup;
  lastSynced: string | null;
};

let INVESTMENTS_CACHE: DashboardCache | null = null;

function formatRupees(value: number) {
  const sign = value >= 0 ? '' : '-';
  return `${sign}₹${Math.abs(Math.round(value)).toLocaleString('en-IN')}`;
}

function sumHoldingValues(holdings: RawHolding[]) {
  const totalInvested = holdings.reduce((sum, h) => sum + (h.qty * h.avgPrice), 0);
  const currentValue = holdings.reduce((sum, h) => sum + (h.qty * h.lastPrice), 0);
  const pnl = currentValue - totalInvested;
  return { totalInvested, currentValue, pnl };
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <Icon size={16} style={{ color: 'var(--text)' }} />
      <div style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--text)' }}>{children}</div>
    </div>
  );
}

function MetricsSection({
  title,
  holdings,
}: {
  title: string;
  holdings: RawHolding[];
}) {
  const stats = sumHoldingValues(holdings);

  return (
    <div className="sec" style={{ margin: '10px 0 4px' }}>
      <SectionTitle icon={TrendingUp}>{title}</SectionTitle>
      <div className="kpis" style={{ gap: 4, marginBottom: 0 }}>
        <div className="kpi-card" style={{ borderRadius: 10 }}>
          <div className="kpi-card-l">Invested</div>
          <div className="kpi-card-v kpi-card-v-soft" style={{ color: 'var(--text)' }}>{formatRupees(stats.totalInvested)}</div>
        </div>
        <div className="kpi-card" style={{ borderRadius: 10 }}>
          <div className="kpi-card-l">Current</div>
          <div className="kpi-card-v kpi-card-v-soft" style={{ color: 'var(--text)' }}>{formatRupees(stats.currentValue)}</div>
        </div>
        <div className={`kpi-card ${stats.pnl >= 0 ? 'kpi-card--green' : 'kpi-card--red'}`} style={{ borderRadius: 10 }}>
          <div className="kpi-card-l">P&L</div>
          <div className="kpi-card-v kpi-card-v-soft" style={{ color: 'var(--text)' }}>
            {stats.pnl >= 0 ? '+' : ''}{formatRupees(stats.pnl)}
          </div>
        </div>
        <div className="kpi-card" style={{ borderRadius: 10 }}>
          <div className="kpi-card-l">Holdings</div>
          <div className="kpi-card-v kpi-card-v-soft" style={{ color: 'var(--text)' }}>{holdings.length}</div>
        </div>
      </div>
    </div>
  );
}

function DashboardView() {
  const [loading, setLoading] = useState(() => INVESTMENTS_CACHE === null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [hasToken, setHasToken] = useState(() => INVESTMENTS_CACHE?.hasToken ?? false);
  const [data, setData] = useState<HoldingsGroup>(() => INVESTMENTS_CACHE?.data ?? { stocks: [], mutualFunds: [] });

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      if (INVESTMENTS_CACHE) {
        setHasToken(INVESTMENTS_CACHE.hasToken);
        setData(INVESTMENTS_CACHE.data);
        setLoading(false);
        return;
      }
      const status = await api.getTokenStatus();
      setHasToken(status.hasToken);
      if (!status.hasToken) {
        const next = { stocks: [], mutualFunds: [] };
        setData(next);
        INVESTMENTS_CACHE = { hasToken: false, data: next, lastSynced: null };
        return;
      }
      const [stocks, mutualFunds] = await Promise.all([
        api.getStocks(),
        api.getMutualFunds(),
      ]);
      const next = { stocks: stocks as RawHolding[], mutualFunds: mutualFunds as RawHolding[] };
      setData(next);
      INVESTMENTS_CACHE = {
        hasToken: true,
        data: next,
        lastSynced: (() => {
          const stamps = [next.stocks[0]?.synced, next.mutualFunds[0]?.synced].filter(Boolean) as string[];
          if (stamps.length === 0) return null;
          const sorted = stamps.sort();
          return sorted[sorted.length - 1] ?? null;
        })(),
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load investments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const syncAll = async () => {
    try {
      setSyncing(true);
      setError('');
      api.invalidateCache();
      await Promise.all([api.syncStocks(), api.syncMutualFunds()]);
      INVESTMENTS_CACHE = null;
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const stats = useMemo(() => {
    const stocksStats = sumHoldingValues(data.stocks);
    const mfStats = sumHoldingValues(data.mutualFunds);
    const totalInvested = stocksStats.totalInvested + mfStats.totalInvested;
    const currentValue = stocksStats.currentValue + mfStats.currentValue;
    const totalPnL = currentValue - totalInvested;
    const totalPnLPct = totalInvested > 0 ? ((totalPnL / totalInvested) * 100) : 0;
    return { stocksStats, mfStats, totalInvested, currentValue, totalPnL, totalPnLPct };
  }, [data]);

  return (
    <div className="pg">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div className="section-title">
          <BarChart3 size={20} className="section-title-icon" />
          <div>Metrics</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {loading && <Loader2 size={16} className="spin-icon" style={{ color: 'var(--muted)' }} />}
          <button
            className="settings-action-btn"
            onClick={syncAll}
            disabled={syncing || !hasToken}
          >
            <RefreshCw size={14} className={syncing ? 'spin-icon' : ''} />
            {syncing ? 'Syncing' : 'Sync'}
          </button>
        </div>
      </div>

      {error && <div className="settings-alert">⚠ {error}</div>}

      {loading ? (
        <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
          <Loader2 size={18} className="spin-icon" style={{ color: 'var(--muted)' }} />
        </div>
      ) : hasToken ? (
        <>
          <div className="kpis">
            <div className="kpi-card">
              <div className="kpi-card-l">Total Invested</div>
              <div className="kpi-card-v kpi-card-v-soft">{formatRupees(stats.totalInvested)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-l">Current Value</div>
              <div className="kpi-card-v kpi-card-v-soft">{formatRupees(stats.currentValue)}</div>
            </div>
            <div className={`kpi-card ${stats.totalPnL >= 0 ? 'kpi-card--green' : 'kpi-card--red'}`}>
              <div className="kpi-card-l">Total P&L</div>
              <div className={`kpi-card-v kpi-card-v-soft ${stats.totalPnL >= 0 ? 'kpi-card-v--green' : 'kpi-card-v--red'}`}>
                {stats.totalPnL >= 0 ? '+' : ''}{formatRupees(stats.totalPnL)}
              </div>
            </div>
            <div className={`kpi-card ${stats.totalPnLPct >= 0 ? 'kpi-card--green' : 'kpi-card--red'}`}>
              <div className="kpi-card-l">Return %</div>
              <div className={`kpi-card-v kpi-card-v-soft ${stats.totalPnLPct >= 0 ? 'kpi-card-v--green' : 'kpi-card-v--red'}`}>
                {stats.totalPnLPct >= 0 ? '+' : ''}{Math.round(stats.totalPnLPct)}%
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 2 }}>
            <MetricsSection title="Stocks" holdings={data.stocks} />
            <MetricsSection title="Mutual Funds" holdings={data.mutualFunds} />
          </div>
        </>
      ) : (
        <div className="sec">
          <div style={{
            padding: '1.5rem',
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '0.375rem',
            textAlign: 'center'
          }}>
            <p style={{ marginBottom: '0.75rem', color: 'var(--text)', fontSize: '0.875rem' }}>
              No portfolio data available yet.
            </p>
            <p style={{ marginBottom: 0, color: 'var(--muted)', fontSize: '0.75rem' }}>
              Connect Upstox in Settings to load your portfolio.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Investments() {
  const [activeTab, setActiveTab] = useState<InvestmentTab>('dashboard');

  return (
    <div style={{ paddingBottom: 64 }}>
      <nav className="tab-bar">
        <button
          className={`tab-item${activeTab === 'dashboard' ? ' active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <span className="tab-icon"><LayoutDashboard size={19} /></span>
          <span>Dashboard</span>
        </button>
        <button
          className={`tab-item${activeTab === 'stocks' ? ' active' : ''}`}
          onClick={() => setActiveTab('stocks')}
        >
          <span className="tab-icon"><TrendingUp size={19} /></span>
          <span>Stocks</span>
        </button>
        <button
          className={`tab-item${activeTab === 'mutualFunds' ? ' active' : ''}`}
          onClick={() => setActiveTab('mutualFunds')}
        >
          <span className="tab-icon"><PieChart size={19} /></span>
          <span>Mutual Funds</span>
        </button>
      </nav>

      <div className="pg" style={{ padding: '8px 8px 24px' }}>
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'stocks' && <Stocks embedded />}
        {activeTab === 'mutualFunds' && <MutualFunds embedded />}
      </div>
    </div>
  );
}

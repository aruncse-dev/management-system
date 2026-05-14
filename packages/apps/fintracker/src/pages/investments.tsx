import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BarChart3, LayoutDashboard, PieChart, RefreshCw, Shield, TrendingUp, Wallet } from 'lucide-react';
import { api, type RawHolding } from '../api';
import { KpiCard, KpiGrid, LoadingState, SectionBlock, Spacer } from '../ui';
import { useFormatMoney } from '../hooks/useFormatMoney';
import Stocks, { clearStocksCache } from './stocks';
import MutualFunds, { clearMutualFundsCache } from './mutualfunds';

type InvestmentTab = 'dashboard' | 'stocks' | 'mutualFunds';

type HoldingsGroup = {
  stocks: RawHolding[];
  mutualFunds: RawHolding[];
};

type DashboardCache = {
  /** Bumps when dashboard load semantics change (ignore stale in-memory cache). */
  version: number;
  hasToken: boolean;
  data: HoldingsGroup;
  lastSynced: string | null;
};

const DASHBOARD_CACHE_VERSION = 2;

let INVESTMENTS_CACHE: DashboardCache | null = null;

function isValidInvestmentsCache(c: DashboardCache | null): c is DashboardCache {
  return c !== null && c.version === DASHBOARD_CACHE_VERSION;
}

function sumHoldingValues(holdings: RawHolding[]) {
  const totalInvested = holdings.reduce((sum, h) => sum + (h.qty * h.avgPrice), 0);
  const currentValue = holdings.reduce((sum, h) => sum + (h.qty * h.lastPrice), 0);
  const pnl = currentValue - totalInvested;
  return { totalInvested, currentValue, pnl };
}

function MetricsSection({
  title,
  holdings,
  icon,
}: {
  title: string;
  holdings: RawHolding[];
  icon: ReactNode;
}) {
  const fmt = useFormatMoney();
  const stats = sumHoldingValues(holdings);

  return (
    <>
      <SectionBlock title={title} icon={icon}>
        <KpiGrid>
          <KpiCard label="Invested" value={fmt(stats.totalInvested)} icon={<Wallet size={14} />} tone="muted" />
          <KpiCard label="Current" value={fmt(stats.currentValue)} icon={<TrendingUp size={14} />} tone="muted" />
          <KpiCard
            label="P&L"
            value={`${stats.pnl >= 0 ? '+' : ''}${fmt(stats.pnl)}`}
            icon={<Shield size={14} />}
            tone="muted"
            accentTone={stats.pnl >= 0 ? 'green' : 'red'}
          />
          <KpiCard label="Holdings" value={holdings.length} icon={<PieChart size={14} />} tone="muted" />
        </KpiGrid>
      </SectionBlock>
    </>
  );
}

function DashboardView() {
  const fmt = useFormatMoney();
  const [loading, setLoading] = useState(() => !isValidInvestmentsCache(INVESTMENTS_CACHE));
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [hasToken, setHasToken] = useState(() => (isValidInvestmentsCache(INVESTMENTS_CACHE) ? INVESTMENTS_CACHE.hasToken : false));
  const [data, setData] = useState<HoldingsGroup>(() =>
    isValidInvestmentsCache(INVESTMENTS_CACHE) ? INVESTMENTS_CACHE.data : { stocks: [], mutualFunds: [] },
  );

  const loadDashboard = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError('');
      if (!forceRefresh && isValidInvestmentsCache(INVESTMENTS_CACHE)) {
        setHasToken(INVESTMENTS_CACHE.hasToken);
        setData(INVESTMENTS_CACHE.data);
        setLoading(false);
        return;
      }
      if (forceRefresh) {
        clearStocksCache();
        clearMutualFundsCache();
        api.invalidateCache({ action: 'getTokenStatus', params: { module: 'stocks' } });
        api.invalidateCache({ action: 'getHoldings', params: { module: 'stocks' } });
        api.invalidateCache({ action: 'getHoldings', params: { module: 'mutualfunds' } });
        INVESTMENTS_CACHE = null;
      }
      const [status, stocks, mutualFunds] = await Promise.all([
        api.getTokenStatus(),
        api.getStocks(),
        api.getMutualFunds(),
      ]);
      const connected = Boolean(
        (status.hasToken || status.hasAccessToken || status.hasExtendedToken) && !status.expired,
      );
      setHasToken(connected);
      const next = { stocks: stocks as RawHolding[], mutualFunds: mutualFunds as RawHolding[] };
      setData(next);
      INVESTMENTS_CACHE = {
        version: DASHBOARD_CACHE_VERSION,
        hasToken: connected,
        data: next,
        lastSynced: (() => {
          const stamps = [...next.stocks, ...next.mutualFunds]
            .map((h) => h.synced)
            .filter(Boolean) as string[];
          if (stamps.length === 0) return null;
          const sorted = [...stamps].sort();
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
      clearStocksCache();
      clearMutualFundsCache();
      api.invalidateCache({ action: 'getTokenStatus', params: { module: 'stocks' } });
      api.invalidateCache({ action: 'getHoldings', params: { module: 'stocks' } });
      api.invalidateCache({ action: 'getHoldings', params: { module: 'mutualfunds' } });
      await api.syncStocks();
      await loadDashboard(true);
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
    <div className="ui-kit-page-shell">
      <Spacer size={8} />
      <SectionBlock
        title="Metrics"
        icon={<BarChart3 size={14} />}
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {loading && <LoadingState variant="inline" />}
            <button
              className="settings-action-btn"
              onClick={syncAll}
              disabled={syncing || !hasToken}
            >
              <RefreshCw size={14} className={syncing ? 'spin-icon' : ''} />
              {syncing ? 'Syncing' : 'Sync'}
            </button>
          </div>
        }
      >
        <KpiGrid>
          <KpiCard label="Total Invested" value={fmt(stats.totalInvested)} icon={<Wallet size={14} />} tone="muted" />
          <KpiCard label="Current Value" value={fmt(stats.currentValue)} icon={<TrendingUp size={14} />} tone="muted" />
          <KpiCard
            label="Total P&L"
            value={`${stats.totalPnL >= 0 ? '+' : ''}${fmt(stats.totalPnL)}`}
            icon={<Shield size={14} />}
            tone="muted"
            accentTone={stats.totalPnL >= 0 ? 'green' : 'red'}
          />
          <KpiCard label="Return %" value={`${stats.totalPnLPct >= 0 ? '+' : ''}${Math.round(stats.totalPnLPct)}%`} icon={<PieChart size={14} />} tone="muted" />
        </KpiGrid>
      </SectionBlock>

      {error && <div className="settings-alert">⚠ {error}</div>}

      {loading ? (
        <LoadingState />
      ) : (
        <div>
          <MetricsSection title="Stocks" holdings={data.stocks} icon={<TrendingUp size={14} />} />
          <MetricsSection title="Mutual Funds" holdings={data.mutualFunds} icon={<PieChart size={14} />} />
        </div>
      )}
    </div>
  );
}

export default function Investments() {
  const [activeTab, setActiveTab] = useState<InvestmentTab>('dashboard');

  return (
    <div className="ui-kit-page-shell investments-page">
      <nav className="bottom-nav">
        <button
          type="button"
          className={`bottom-nav-item${activeTab === 'dashboard' ? ' active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <span className="bottom-nav-icon"><LayoutDashboard size={19} /></span>
          <span>Dashboard</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item${activeTab === 'stocks' ? ' active' : ''}`}
          onClick={() => setActiveTab('stocks')}
        >
          <span className="bottom-nav-icon"><TrendingUp size={19} /></span>
          <span>Stocks</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item${activeTab === 'mutualFunds' ? ' active' : ''}`}
          onClick={() => setActiveTab('mutualFunds')}
        >
          <span className="bottom-nav-icon"><PieChart size={19} /></span>
          <span>Mutual Funds</span>
        </button>
      </nav>

      <div className="pg">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'stocks' && <Stocks embedded />}
        {activeTab === 'mutualFunds' && <MutualFunds embedded />}
      </div>
    </div>
  );
}

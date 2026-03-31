import { useEffect, useState, useMemo } from 'react';
import { BarChart3, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { api } from '../api';
import { HoldingCard, HoldingModal, SectionBlock, SectionChip, Spacer } from '../ui-kit';

interface Holding {
  symbol: string;
  company: string;
  isin: string;
  qty: number;
  avgPrice: number;
  lastPrice: number;
  pnl: number;
  dayChangePct: number;
  synced: string;
}

let STOCKS_CACHE: Holding[] | null = null;

function getCachedStocks() {
  return STOCKS_CACHE ? [...STOCKS_CACHE] : null;
}

function setCachedStocks(data: Holding[]) {
  STOCKS_CACHE = [...data];
}

export default function Stocks({ embedded = false }: { embedded?: boolean } = {}) {
  const [holdings, setHoldings] = useState<Holding[]>(() => getCachedStocks() ?? []);
  const [loading, setLoading] = useState(() => getCachedStocks() === null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasToken, setHasToken] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Load token status and holdings on mount
  useEffect(() => {
    loadTokenStatus();

    // Detect when user returns from OAuth in another tab
    const handleFocus = () => {
      loadTokenStatus();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loadTokenStatus = async (forceRefresh = false) => {
    try {
      setError('');
      if (forceRefresh) {
        api.invalidateCache();
      }
      const status = await api.getTokenStatus();
      setHasToken(status.hasToken);
      const cached = getCachedStocks();
      if (status.hasToken && (!cached || forceRefresh)) {
        await loadHoldings();
      } else {
        if (cached) setHoldings(cached);
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to load token status:', err);
      setError('Failed to check token');
      setLoading(false);
    }
  };

  const loadHoldings = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getStocks();
      const next = data as Holding[];
      setHoldings(next);
      setCachedStocks(next);
    } catch (err: any) {
      console.error('Failed to load holdings:', err);
      if (err.message === 'REAUTH_REQUIRED' || err.message === 'TOKEN_EXPIRED') {
        setHasToken(false);
        setError('Access token expired. Please reconnect.');
      } else {
        setError(err.message || 'Failed to load holdings');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError('');
      await api.syncStocks();
      api.invalidateCache();
      await loadHoldings();
    } catch (err: any) {
      console.error('Sync failed:', err);
      if (err.message === 'REAUTH_REQUIRED') {
        setHasToken(false);
        setError('Session expired. Please reconnect.');
      } else if (err.message === 'TOKEN_EXPIRED') {
        setHasToken(false);
        setError('Access token expired. Please reconnect.');
      } else {
        setError(err.message || 'Sync failed');
      }
    } finally {
      setSyncing(false);
    }
  };

  const stats = useMemo(() => {
    if (holdings.length === 0) {
      return { totalInvested: 0, currentValue: 0, totalPnL: 0, totalPnLPct: 0 };
    }
    const totalInvested = holdings.reduce((sum, h) => sum + (h.qty * h.avgPrice), 0);
    const currentValue = holdings.reduce((sum, h) => sum + (h.qty * h.lastPrice), 0);
    const totalPnL = currentValue - totalInvested;
    const totalPnLPct = totalInvested > 0 ? ((totalPnL / totalInvested) * 100) : 0;
    return { totalInvested, currentValue, totalPnL, totalPnLPct };
  }, [holdings]);

  const lastSynced = useMemo(() => {
    if (holdings.length === 0) return null;
    return holdings[0].synced;
  }, [holdings]);

  const enrichedHoldings = useMemo(() => {
    return holdings.map(h => {
      const invested = h.qty * h.avgPrice;
      const current = h.qty * h.lastPrice;
      const pnlPct = invested > 0 ? ((h.pnl / invested) * 100) : 0;
      return {
        ...h,
        invested,
        current,
        pnlPct
      };
    });
  }, [holdings]);

  function formatRupees(value: number) {
    const sign = value >= 0 ? '' : '-';
    return `${sign}₹${Math.abs(Math.round(value)).toLocaleString('en-IN')}`;
  }

  if (embedded && loading) {
    return (
      <div className="pg">
        <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}>
          <Loader2 size={18} className="spin-icon" style={{ color: 'var(--muted)' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="pg" style={{ paddingTop: embedded ? 0 : 16 }}>
      <Spacer size={8} />
      {!embedded && (
        <>
          <SectionBlock
            title="Metrics"
            icon={<BarChart3 size={14} />}
            right={
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={handleSync}
                  disabled={syncing || !hasToken}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid var(--border)',
                    background: '#FFFFFF',
                    borderRadius: '0.375rem',
                    cursor: syncing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: syncing || !hasToken ? 0.6 : 1
                  }}
                >
                  <RefreshCw size={16} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                  {syncing ? 'Syncing...' : 'Sync'}
                </button>
                {loading && !syncing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
                    <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTop: '2px solid var(--text)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                )}
              </div>
            }
          >
            <div className="kpis">
              <div className="kpi-card">
                <div className="kpi-card-l">Total Invested</div>
                <div className="kpi-card-v kpi-card-v-soft">
                  {formatRupees(stats.totalInvested)}
                </div>
              </div>
              <div className="kpi-card">
                <div className="kpi-card-l">Current Value</div>
                <div className="kpi-card-v kpi-card-v-soft">
                  {formatRupees(stats.currentValue)}
                </div>
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
                  {stats.totalPnLPct >= 0 ? '+' : ''}{Number(stats.totalPnLPct.toFixed(2))}%
                </div>
              </div>
            </div>
          </SectionBlock>

          {/* Error message */}
          {error && (
            <div style={{
              padding: '1rem',
              background: '#FEE2E2',
              color: '#991B1B',
              borderRadius: '0.375rem',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          {/* Last synced */}
          {lastSynced && (
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '1rem' }}>
              Last synced: {new Date(lastSynced).toLocaleString()}
            </div>
          )}
        </>
      )}

      {/* Holdings as cards */}
      {holdings.length === 0 && !loading ? (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: '0.875rem'
        }}>
          {hasToken ? 'No holdings found. Click "Sync" to fetch your portfolio.' : 'No portfolio data available yet.'}
        </div>
      ) : (
        <>
        <SectionBlock
          title="Stocks"
          icon={<TrendingUp size={14} />}
          rightChip={<SectionChip tone="muted">{enrichedHoldings.length} items</SectionChip>}
        >

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '8px'
          }}>
            {enrichedHoldings.map((h, i) => (
              <HoldingCard
                key={i}
                title={h.symbol}
                subtitle={h.company}
                leftLabel="QTY"
                leftValue={Math.round(h.qty).toLocaleString('en-IN')}
                centerLabel="INVESTED"
                centerValue={formatRupees(h.invested)}
                rightLabel="CURRENT"
                rightValue={formatRupees(h.current)}
                pnlLabel={h.pnl >= 0 ? 'PROFIT' : 'LOSS'}
                pnlValue={`${h.pnl >= 0 ? '+' : ''}${formatRupees(h.pnl)}`}
                accentTone={h.pnl >= 0 ? 'green' : 'red'}
                onClick={() => setSelectedIndex(i)}
                className="stock-entry-card"
              />
            ))}
          </div>

        {/* Modal */}
        {selectedIndex !== null && enrichedHoldings[selectedIndex] && (
          <HoldingModal
            title={enrichedHoldings[selectedIndex].symbol}
            onClose={() => setSelectedIndex(null)}
            pnlLabel={enrichedHoldings[selectedIndex].pnl >= 0 ? 'Profit' : 'Loss'}
            pnlValue={`${enrichedHoldings[selectedIndex].pnl >= 0 ? '+' : ''}${formatRupees(enrichedHoldings[selectedIndex].pnl)}`}
            pnlPct={`(${enrichedHoldings[selectedIndex].pnlPct >= 0 ? '+' : ''}${Number(enrichedHoldings[selectedIndex].pnlPct.toFixed(2))}%)`}
            accentTone={enrichedHoldings[selectedIndex].pnl >= 0 ? 'green' : 'red'}
          >
            <div className="ui-kit-holding-detail">
              <div className="ui-kit-holding-detail-label">ISIN</div>
              <div className="ui-kit-holding-detail-value">{enrichedHoldings[selectedIndex].isin}</div>
            </div>
            <div className="ui-kit-holding-detail">
              <div className="ui-kit-holding-detail-label">Qty</div>
              <div className="ui-kit-holding-detail-value">{Math.round(enrichedHoldings[selectedIndex].qty).toLocaleString('en-IN')}</div>
            </div>
            <div className="ui-kit-holding-detail">
              <div className="ui-kit-holding-detail-label">Avg Price</div>
              <div className="ui-kit-holding-detail-value">{formatRupees(enrichedHoldings[selectedIndex].avgPrice)}</div>
            </div>
            <div className="ui-kit-holding-detail">
              <div className="ui-kit-holding-detail-label">CMP</div>
              <div className="ui-kit-holding-detail-value">{formatRupees(enrichedHoldings[selectedIndex].lastPrice)}</div>
            </div>
            <div className="ui-kit-holding-detail">
              <div className="ui-kit-holding-detail-label">Invested</div>
              <div className="ui-kit-holding-detail-value">{formatRupees(enrichedHoldings[selectedIndex].invested)}</div>
            </div>
            <div className="ui-kit-holding-detail">
              <div className="ui-kit-holding-detail-label">Current Value</div>
              <div className="ui-kit-holding-detail-value">{formatRupees(enrichedHoldings[selectedIndex].current)}</div>
            </div>
            <div className="ui-kit-holding-detail">
              <div className="ui-kit-holding-detail-label">Day Change</div>
              <div className="ui-kit-holding-detail-value" style={{ color: enrichedHoldings[selectedIndex].dayChangePct >= 0 ? '#16A34A' : '#DC2626' }}>
                {enrichedHoldings[selectedIndex].dayChangePct >= 0 ? '+' : ''}{Number(enrichedHoldings[selectedIndex].dayChangePct.toFixed(2))}%
              </div>
            </div>
          </HoldingModal>
        )}
        </SectionBlock>
        </>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

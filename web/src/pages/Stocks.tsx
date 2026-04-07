import { useEffect, useState, useMemo } from 'react';
import { BarChart3, RefreshCw, TrendingUp } from 'lucide-react';
import { api } from '../api';
import { HoldingCard, HoldingModal, InfoCallout, KpiCard, LoadingState, SectionBlock, SectionChip, Spacer } from '../ui-kit';

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

export function clearStocksCache() {
  STOCKS_CACHE = null;
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
    loadHoldings();
    loadTokenStatus();
  }, []);

  const loadTokenStatus = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        api.invalidateCache({ action: 'getTokenStatus', params: { module: 'stocks' } });
      }
      const status = await api.getTokenStatus();
      const connected = Boolean((status.hasToken || status.hasAccessToken || status.hasExtendedToken) && !status.expired);
      setHasToken(connected);
    } catch (err) {
      console.error('Failed to load token status:', err);
      setError('Failed to check token');
    }
  };

  const loadHoldings = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError('');
      if (forceRefresh) {
        clearStocksCache();
        api.invalidateCache({ action: 'getHoldings', params: { module: 'stocks' } });
      } else {
        const cached = getCachedStocks();
        if (cached) {
          setHoldings(cached);
          setLoading(false);
          return;
        }
      }
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
      api.invalidateCache({ action: 'getHoldings', params: { module: 'stocks' } });
      await api.syncStocks();
      await loadHoldings(true);
      await loadTokenStatus(true);
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
      <div className="pg"><LoadingState /></div>
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
              <button
                onClick={handleSync}
                disabled={syncing || !hasToken}
                className="ui-kit-btn ui-kit-btn--soft"
              >
                <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
            }
          >
            <div className="dash-grid">
              <KpiCard label="Total Invested" value={formatRupees(stats.totalInvested)} tone="navy" />
              <KpiCard label="Current Value" value={formatRupees(stats.currentValue)} tone="navy" />
              <KpiCard
                label="Total P&L"
                value={`${stats.totalPnL >= 0 ? '+' : ''}${formatRupees(stats.totalPnL)}`}
                tone={stats.totalPnL >= 0 ? 'green' : 'red'}
                accentTone={stats.totalPnL >= 0 ? 'green' : 'red'}
              />
              <KpiCard
                label="Return %"
                value={`${stats.totalPnLPct >= 0 ? '+' : ''}${Number(stats.totalPnLPct.toFixed(2))}%`}
                tone={stats.totalPnLPct >= 0 ? 'green' : 'red'}
                accentTone={stats.totalPnLPct >= 0 ? 'green' : 'red'}
              />
            </div>
          </SectionBlock>

          {/* Error message */}
          {error && <InfoCallout title="Error" tone="red">{error}</InfoCallout>}

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
          {hasToken
            ? 'No stock holdings found in the Stocks sheet. Your token is being used to sync fresh portfolio data.'
            : 'No stock holdings found in the Stocks sheet. Connect Upstox in Settings so your token can sync fresh portfolio data.'}
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

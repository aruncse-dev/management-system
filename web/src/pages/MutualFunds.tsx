import { useEffect, useState, useMemo } from 'react';
import { BarChart3, PieChart, Loader2 } from 'lucide-react';
import { api } from '../api';

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

let MF_CACHE: Holding[] | null = null;

function getCachedHoldings() {
  return MF_CACHE ? [...MF_CACHE] : null;
}

function setCachedHoldings(data: Holding[]) {
  MF_CACHE = [...data];
}

export default function MutualFunds({ embedded = false }: { embedded?: boolean } = {}) {
  const [holdings, setHoldings] = useState<Holding[]>(() => getCachedHoldings() ?? []);
  const [loading, setLoading] = useState(() => getCachedHoldings() === null);
  const [error, setError] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Load holdings on mount
  useEffect(() => {
    loadHoldings();
  }, []);

  const loadHoldings = async () => {
    try {
      setError('');
      const cached = getCachedHoldings();
      if (cached) {
        setHoldings(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
      const data = await api.getMutualFunds();
      const next = data as Holding[];
      setHoldings(next);
      setCachedHoldings(next);
    } catch (err: any) {
      console.error('Failed to load holdings:', err);
      setError(err.message || 'Failed to load holdings');
    } finally {
      setLoading(false);
    }
  };

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
    <div className="pg">
      {!embedded && (
        <>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div className="section-title">
              <BarChart3 size={20} className="section-title-icon" />
              <div>Metrics</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
                  <Loader2 size={16} className="spin-icon" />
                </div>
              )}
            </div>
          </div>

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

          {/* Summary strip - KPIs */}
          <div className="kpis" style={{ marginBottom: '1.5rem' }}>
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
            <div className="kpi-card">
              <div className="kpi-card-l">Total P&L</div>
              <div className={`kpi-card-v kpi-card-v-soft ${stats.totalPnL >= 0 ? 'kpi-card-v--green' : 'kpi-card-v--red'}`}>
                {stats.totalPnL >= 0 ? '+' : ''}{formatRupees(stats.totalPnL)}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-l">Return %</div>
              <div className={`kpi-card-v kpi-card-v-soft ${stats.totalPnLPct >= 0 ? 'kpi-card-v--green' : 'kpi-card-v--red'}`}>
                {stats.totalPnLPct >= 0 ? '+' : ''}{Number(stats.totalPnLPct.toFixed(2))}%
              </div>
            </div>
          </div>
        </>
      )}

      {/* Holdings content */}
      {!loading && holdings.length === 0 ? (
        <div className="sec">
          <div style={{
            padding: '1.5rem',
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '0.375rem',
            textAlign: 'center'
          }}>
            <p style={{ marginBottom: '0.75rem', color: 'var(--text)', fontSize: '0.875rem' }}>
              No mutual fund holdings found.
            </p>
            <p style={{ marginBottom: 0, color: 'var(--muted)', fontSize: '0.75rem' }}>
              Update the MutualFunds sheet in your Assets spreadsheet to load your data.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Holdings section header */}
          <div className="section-title" style={{ marginBottom: '1.5rem' }}>
            <PieChart size={20} className="section-title-icon" />
            <div>Mutual Funds</div>
          </div>

          {/* Holdings as cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem'
          }}>
            {enrichedHoldings.map((h, i) => (
              <div
                key={i}
                onClick={() => setSelectedIndex(i)}
                style={{
                  padding: '0.875rem',
                  background: '#FFFFFF',
                  border: '1px solid var(--border)',
                  borderRadius: '0.375rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                {/* Fund name */}
                <div>
                  <div className="holding-label" style={{ marginBottom: '0.1rem' }}>FUND NAME</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, lineHeight: '1.3' }}>{h.company}</div>
                </div>

                {/* Units & P&L */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <div className="holding-label" style={{ marginBottom: '0.1rem' }}>UNITS</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{Math.round(h.qty).toLocaleString('en-IN')}</div>
                  </div>
                  <div style={{
                    padding: '0.5rem 0.625rem',
                    background: h.pnl >= 0 ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                    borderRadius: '0.375rem',
                    borderLeft: `3px solid ${h.pnl >= 0 ? '#16A34A' : '#DC2626'}`
                  }}>
                    <div className="holding-label" style={{ marginBottom: '0.1rem' }}>P&L</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: h.pnl >= 0 ? '#16A34A' : '#DC2626' }}>
                      {h.pnl >= 0 ? '+' : ''}{formatRupees(h.pnl)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

        {/* Modal */}
        {selectedIndex !== null && enrichedHoldings[selectedIndex] && (
          <div className="modal-bg open" onClick={() => setSelectedIndex(null)}>
            <div className="sheet-panel" onClick={e => e.stopPropagation()}>
              <div className="sheet-body">
                {(() => {
                  const h = enrichedHoldings[selectedIndex];
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 700 }}>{h.company}</div>
                        <button
                          onClick={() => setSelectedIndex(null)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            color: 'var(--muted)',
                            padding: 0
                          }}
                        >
                          ✕
                        </button>
                      </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <div className="holding-label" style={{ marginBottom: '0.1rem' }}>Folio</div>
                        <div style={{ fontSize: '0.9rem' }}>{h.isin}</div>
                      </div>
                      <div>
                        <div className="holding-label" style={{ marginBottom: '0.1rem' }}>Code</div>
                        <div style={{ fontSize: '0.9rem' }}>{h.symbol}</div>
                      </div>
                      <div>
                        <div className="holding-label" style={{ marginBottom: '0.1rem' }}>Units</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{Math.round(h.qty).toLocaleString('en-IN')}</div>
                      </div>
                      <div>
                        <div className="holding-label" style={{ marginBottom: '0.1rem' }}>Avg Price</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{formatRupees(h.avgPrice)}</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <div className="holding-label" style={{ marginBottom: '0.1rem' }}>Invested</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{formatRupees(h.invested)}</div>
                      </div>
                      <div>
                        <div className="holding-label" style={{ marginBottom: '0.1rem' }}>Current</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{formatRupees(h.current)}</div>
                      </div>
                    </div>

                    <div style={{
                      padding: '0.75rem',
                      background: h.pnl >= 0 ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                      borderRadius: '0.375rem',
                      borderLeft: `4px solid ${h.pnl >= 0 ? '#16A34A' : '#DC2626'}`
                    }}>
                      <div className="holding-label" style={{ marginBottom: '0.1rem' }}>Profit / Loss</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: h.pnl >= 0 ? '#16A34A' : '#DC2626' }}>
                          {h.pnl >= 0 ? '+' : ''}{formatRupees(h.pnl)}
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: h.pnlPct >= 0 ? '#16A34A' : '#DC2626' }}>
                          ({h.pnlPct >= 0 ? '+' : ''}{Number(h.pnlPct.toFixed(2))}%)
                        </div>
                      </div>
                    </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
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

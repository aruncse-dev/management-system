import { useEffect, useState, useMemo } from 'react';
import { BarChart3, PieChart } from 'lucide-react';
import { api } from '../api';
import { HoldingCard, HoldingModal, KpiCard, KpiGrid, LoadingState, SectionBlock, SectionChip, Spacer } from '../ui';

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

export function clearMutualFundsCache() {
  MF_CACHE = null;
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

  const loadHoldings = async (forceRefresh = false) => {
    try {
      setError('');
      if (forceRefresh) {
        clearMutualFundsCache();
        api.invalidateCache({ action: 'getHoldings', params: { module: 'mutualfunds' } });
      }
      const cached = getCachedHoldings();
      if (cached && !forceRefresh) {
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
      <div className="pg"><LoadingState /></div>
    );
  }

  return (
    <div className="pg" style={{ paddingTop: embedded ? 0 : undefined }}>
      {!embedded && (
        <>
          <Spacer size={8} />
          <SectionBlock
            title="Metrics"
            icon={<BarChart3 size={14} />}
            right={
              loading ? <LoadingState variant="inline" /> : null
            }
          >
            <KpiGrid>
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
            </KpiGrid>
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
              Add Mutual Funds data in your Assets spreadsheet to load it here.
            </p>
          </div>
        </div>
      ) : (
        <>
          <Spacer size={8} />
          <SectionBlock
            title="Mutual Funds"
            icon={<PieChart size={14} />}
            rightChip={<SectionChip tone="muted">{enrichedHoldings.length} items</SectionChip>}
          >

          {/* Holdings as cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '0.75rem'
          }}>
            {enrichedHoldings.map((h, i) => (
              <HoldingCard
                key={i}
                title={h.company}
                subtitle={h.symbol}
                leftLabel="UNITS"
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
            title={enrichedHoldings[selectedIndex].company}
            onClose={() => setSelectedIndex(null)}
            pnlLabel={enrichedHoldings[selectedIndex].pnl >= 0 ? 'Profit' : 'Loss'}
            pnlValue={`${enrichedHoldings[selectedIndex].pnl >= 0 ? '+' : ''}${formatRupees(enrichedHoldings[selectedIndex].pnl)}`}
            pnlPct={`(${enrichedHoldings[selectedIndex].pnlPct >= 0 ? '+' : ''}${Number(enrichedHoldings[selectedIndex].pnlPct.toFixed(2))}%)`}
            accentTone={enrichedHoldings[selectedIndex].pnl >= 0 ? 'green' : 'red'}
          >
            <div className="ui-kit-holding-detail">
              <div className="ui-kit-holding-detail-label">Folio</div>
              <div className="ui-kit-holding-detail-value">{enrichedHoldings[selectedIndex].isin}</div>
            </div>
            <div className="ui-kit-holding-detail">
              <div className="ui-kit-holding-detail-label">Code</div>
              <div className="ui-kit-holding-detail-value">{enrichedHoldings[selectedIndex].symbol}</div>
            </div>
            <div className="ui-kit-holding-detail">
              <div className="ui-kit-holding-detail-label">Units</div>
              <div className="ui-kit-holding-detail-value">{Math.round(enrichedHoldings[selectedIndex].qty).toLocaleString('en-IN')}</div>
            </div>
            <div className="ui-kit-holding-detail">
              <div className="ui-kit-holding-detail-label">Avg Price</div>
              <div className="ui-kit-holding-detail-value">{formatRupees(enrichedHoldings[selectedIndex].avgPrice)}</div>
            </div>
            <div className="ui-kit-holding-detail">
              <div className="ui-kit-holding-detail-label">Invested</div>
              <div className="ui-kit-holding-detail-value">{formatRupees(enrichedHoldings[selectedIndex].invested)}</div>
            </div>
            <div className="ui-kit-holding-detail">
              <div className="ui-kit-holding-detail-label">Current</div>
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

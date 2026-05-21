/** Provider-agnostic mutual fund holding shape (Upstox, Zerodha, etc.). */

function numStr(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : null
}

export type MutualFundHoldingInput = {
  /** Stable key per org + provider for replace-on-sync (instrument|folio). */
  holdingKey: string
  fundName: string
  folioNo: string | null
  instrumentKey: string | null
  units: string | null
  avgPrice: string | null
  lastPrice: string | null
  lastPriceDate: string | null
  purchased: string | null
  currentValue: string | null
  profitLoss: string | null
  pledgedQuantity: string | null
  schemeCode: string | null
}

export function mutualFundHoldingKey(instrumentKey: string, folio: string): string {
  const ik = instrumentKey.trim()
  const f = folio.trim()
  if (ik && f) return `${ik}|${f}`
  return ik || f
}

/** Map arbitrary provider JSON row → normalized holding. */
export function normalizeMutualFundHolding(
  raw: Record<string, unknown>,
  index: number,
): MutualFundHoldingInput | null {
  const folio = String(raw.folio ?? raw.folio_no ?? raw.folioNo ?? '').trim()
  const instrumentKey = String(
    raw.instrument_key ?? raw.instrumentKey ?? raw.scheme_code ?? raw.isin ?? '',
  ).trim()
  const fundName = String(
    raw.fund ?? raw.fund_name ?? raw.fundName ?? raw.scheme_name ?? raw.name ?? '',
  ).trim()

  const holdingKey = mutualFundHoldingKey(instrumentKey, folio) || `row-${index}`
  if (!fundName && !instrumentKey && !folio) return null

  const qty = Number(raw.quantity ?? raw.units ?? raw.qty)
  const avg = Number(raw.average_price ?? raw.avg_price ?? raw.averagePrice)
  const last = Number(raw.last_price ?? raw.lastPrice ?? raw.nav)
  const units = Number.isFinite(qty) ? qty : null
  const avgPrice = Number.isFinite(avg) ? avg : null
  const lastPrice = Number.isFinite(last) ? last : null

  let purchased = numStr(raw.purchase_amount ?? raw.invested_amount ?? raw.purchased)
  if (!purchased && units != null && avgPrice != null) {
    purchased = String(Math.round(units * avgPrice * 100) / 100)
  }

  let currentValue = numStr(raw.current_value ?? raw.currentValue ?? raw.market_value)
  if (!currentValue && units != null && lastPrice != null) {
    currentValue = String(Math.round(units * lastPrice * 100) / 100)
  }

  const lastPriceDateRaw = raw.last_price_date ?? raw.lastPriceDate
  const lastPriceDate =
    typeof lastPriceDateRaw === 'string' && lastPriceDateRaw.trim()
      ? lastPriceDateRaw.trim().slice(0, 10)
      : null

  return {
    holdingKey,
    fundName: fundName || instrumentKey || 'Unknown fund',
    folioNo: folio || null,
    instrumentKey: instrumentKey || null,
    units: units != null ? String(units) : null,
    avgPrice: avgPrice != null ? String(avgPrice) : null,
    lastPrice: lastPrice != null ? String(lastPrice) : null,
    lastPriceDate,
    purchased,
    currentValue,
    profitLoss: numStr(raw.pnl ?? raw.profit_loss ?? raw.profitLoss),
    pledgedQuantity: numStr(raw.pledged_quantity ?? raw.pledgedQuantity),
    schemeCode: instrumentKey || null,
  }
}

export function normalizeMutualFundHoldingsPayload(data: unknown): MutualFundHoldingInput[] {
  const rows = Array.isArray(data) ? data : []
  const out: MutualFundHoldingInput[] = []
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const norm = normalizeMutualFundHolding(raw as Record<string, unknown>, i)
    if (norm) out.push(norm)
  }
  return out
}

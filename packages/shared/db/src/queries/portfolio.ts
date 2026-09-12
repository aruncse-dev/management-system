import { and, eq, isNull, notInArray } from "drizzle-orm";
import type { getDb } from "../neon";
import type { MutualFundHoldingInput } from "../mutualFundNormalize";
import { mutualFunds, stocks } from "../schema/portfolio";

export type { MutualFundHoldingInput } from "../mutualFundNormalize";

type Db = ReturnType<typeof getDb>;

export type StockHoldingInput = {
  symbol: string;
  company: string | null;
  isin: string;
  qty: string;
  avgPrice: string | null;
  lastPrice: string | null;
  pnl: string | null;
  dayChangePct: string | null;
};

function orgWhere(orgId: string | null) {
  return orgId ? eq(stocks.orgId, orgId) : isNull(stocks.orgId);
}

function mfOrgWhere(orgId: string | null) {
  return orgId ? eq(mutualFunds.orgId, orgId) : isNull(mutualFunds.orgId);
}

function providerWhere(providerSlug: string) {
  return eq(stocks.providerSlug, providerSlug);
}

function mfProviderWhere(providerSlug: string) {
  return eq(mutualFunds.providerSlug, providerSlug);
}

export type HoldingSyncResult = {
  count: number;
  syncedAt: Date;
  /**
   * The provider returned nothing and the wipe was refused. The caller should
   * surface this rather than reporting a successful sync of zero holdings.
   */
  skippedEmpty?: boolean;
};

export type HoldingSyncOptions = {
  /**
   * Permit an empty provider response to delete every holding for that
   * provider. Off by default: a broker that answers `200 []` during an outage
   * is indistinguishable from one reporting a genuinely closed portfolio, and
   * the destructive reading silently erases the position history plus the net
   * worth that depends on it. Pass this only from an explicit user action.
   */
  allowEmpty?: boolean;
};

/**
 * Replace holdings for one org + integration provider (removes stale rows for
 * that provider only).
 *
 * The delete and the upserts run in a single transaction: without one, a
 * provider timeout partway through leaves the portfolio half-deleted, which
 * reads as a real loss of holdings rather than a failed sync.
 */
export async function syncStockHoldings(
  db: Db,
  orgId: string | null,
  providerSlug: string,
  rows: StockHoldingInput[],
  opts: HoldingSyncOptions = {},
): Promise<HoldingSyncResult> {
  const syncedAt = new Date();
  const isins = rows.map((r) => r.isin).filter((isin) => isin.length > 0);
  const scope = and(orgWhere(orgId), providerWhere(providerSlug));

  if (isins.length === 0) {
    if (!opts.allowEmpty) return { count: 0, syncedAt, skippedEmpty: true };
    await db.delete(stocks).where(scope);
    return { count: 0, syncedAt };
  }

  await db.transaction(async (tx) => {
    await tx.delete(stocks).where(and(scope, notInArray(stocks.isin, isins)));

    for (const row of rows) {
      if (!row.isin) continue;
      const [existing] = await tx
        .select({ id: stocks.id })
        .from(stocks)
        .where(and(scope, eq(stocks.isin, row.isin)))
        .limit(1);

      const values = {
        providerSlug,
        symbol: row.symbol,
        company: row.company,
        isin: row.isin,
        qty: row.qty,
        avgPrice: row.avgPrice,
        lastPrice: row.lastPrice,
        pnl: row.pnl,
        dayChangePct: row.dayChangePct,
        syncedAt,
      };

      if (existing) {
        await tx.update(stocks).set(values).where(eq(stocks.id, existing.id));
      } else {
        await tx.insert(stocks).values({ ...values, orgId });
      }
    }
  });

  return { count: rows.filter((r) => r.isin.length > 0).length, syncedAt };
}

/** Same contract as `syncStockHoldings` — see its notes on `allowEmpty` and the transaction. */
export async function syncMutualFundHoldings(
  db: Db,
  orgId: string | null,
  providerSlug: string,
  rows: MutualFundHoldingInput[],
  opts: HoldingSyncOptions = {},
): Promise<HoldingSyncResult> {
  const syncedAt = new Date();
  const keys = rows.map((r) => r.holdingKey).filter((k) => k.length > 0);
  const scope = and(mfOrgWhere(orgId), mfProviderWhere(providerSlug));

  if (keys.length === 0) {
    if (!opts.allowEmpty) return { count: 0, syncedAt, skippedEmpty: true };
    await db.delete(mutualFunds).where(scope);
    return { count: 0, syncedAt };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(mutualFunds)
      .where(and(scope, notInArray(mutualFunds.holdingKey, keys)));

    for (const row of rows) {
      if (!row.holdingKey) continue;
      const [existing] = await tx
        .select({ id: mutualFunds.id })
        .from(mutualFunds)
        .where(and(scope, eq(mutualFunds.holdingKey, row.holdingKey)))
        .limit(1);

      const values = {
        providerSlug,
        holdingKey: row.holdingKey,
        fundName: row.fundName,
        folioNo: row.folioNo,
        instrumentKey: row.instrumentKey,
        units: row.units,
        avgPrice: row.avgPrice,
        lastPrice: row.lastPrice,
        lastPriceDate: row.lastPriceDate,
        purchased: row.purchased,
        currentValue: row.currentValue,
        profitLoss: row.profitLoss,
        pledgedQuantity: row.pledgedQuantity,
        schemeCode: row.schemeCode,
        syncedAt,
      };

      if (existing) {
        await tx
          .update(mutualFunds)
          .set(values)
          .where(eq(mutualFunds.id, existing.id));
      } else {
        await tx.insert(mutualFunds).values({ ...values, orgId });
      }
    }
  });

  return {
    count: rows.filter((r) => r.holdingKey.length > 0).length,
    syncedAt,
  };
}

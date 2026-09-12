import { useEffect, useState } from 'react'
import type { TransactionRefOption } from '@fintracker-vault/ui'
import { api, type AccountRow } from '../api'
import {
  LENDING_SHEET_SLUG_DEFAULT,
  LENDING_SHEET_SLUG_VIJAYA,
  lendingBookLabel,
} from '../lib/lendingSheetSlug'

/**
 * The module rows a transaction can be linked to.
 *
 * A loan repayment used to be typed twice — once in the register and once on
 * the Loans tab — and the two copies drifted. Linking here lets one entry
 * create both, so the drift has nowhere to come from.
 *
 * Only ongoing loans are offered: a settled loan should not be gaining
 * repayments, and listing every closed loan would bury the live ones.
 */
/**
 * Distinct people in one lending book, as ref options.
 *
 * There is no person table — a lending row is a single LEND or REPAY event — so
 * the reference names the book and the person (`<slug>|<name>`) rather than a
 * row id. Lending money is an Expense, getting it back is Income, and the
 * server picks LEND or REPAY from that.
 */
function lendingPeople(rows: { name: string }[], slug: string): TransactionRefOption[] {
  const seen = new Set<string>()
  const out: TransactionRefOption[] = []
  for (const row of rows) {
    const name = String(row.name ?? '').trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push({
      kind: 'lending',
      id: `${slug}|${name}`,
      label: name,
      group: lendingBookLabel(slug),
      types: ['Expense', 'Income'],
    })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Savings accounts, as ref options.
 *
 * A deposit was only expressible as a `Transfer` whose destination happened to
 * be a savings account — which works, but leaves no way to book one from an
 * ordinary `Expense` the way an EMI repayment or a subscription charge is
 * booked. Offering the account here closes that gap: the server already accepts
 * `ref_kind = 'savings'` with the account id and mirrors it into the savings
 * ledger, so nothing on the API side has to change.
 *
 * `Transfer` is deliberately not among the types: for a transfer the
 * destination picker already decides the savings account, and a second control
 * that silently loses to it would only confuse.
 *
 * Accounts marked `both` are excluded for the same reason the transfer-derived
 * path excludes them — they already show up in the monthly balances, so
 * mirroring one would count the same money twice.
 */
function savingsAccounts(rows: AccountRow[]): TransactionRefOption[] {
  return rows
    .filter(a => a.isActive !== false && !a.closedOn && a.usedFor === 'savings')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    .map(a => ({
      kind: 'savings',
      id: a.id,
      label: a.name,
      group: 'Savings accounts',
      // An RD instalment is fixed, so the amount is known once the account is.
      amount: Number(a.rdInstalment) || undefined,
      types: ['Expense'] as const,
    }))
}

/**
 * Where a linked row can be seen, for the jump button on a transaction card.
 *
 * Takes the stored `ref_kind`/`ref_id` so it works from a saved row as well as
 * from a picker option. Each loan type lands on its own tab rather than the
 * Loans dashboard, so the jump arrives at the list the row is actually in.
 * Lending has no row id — its ref is `<sheetSlug>|<name>` — so it opens that book.
 */
export function transactionRefHref(ref: { kind: string; id: string }): string | undefined {
  switch (ref.kind) {
    case 'emi_loan':
      return '/loans?tab=emi'
    case 'jewel_loan':
      return '/loans?tab=jewel'
    case 'cash_loan':
      return '/loans?tab=cash'
    case 'subscription':
      return '/subscriptions'
    case 'savings':
      return '/savings'
    case 'lending': {
      const slug = ref.id.split('|')[0]?.trim()
      return slug ? `/lending?sheet=${encodeURIComponent(slug)}` : '/lending'
    }
    default:
      return undefined
  }
}

/** Human name for a `ref_kind`, for the jump button's tooltip. */
export function transactionRefKindLabel(kind: string): string {
  switch (kind) {
    case 'emi_loan': return 'EMI loans'
    case 'jewel_loan': return 'Jewel loans'
    case 'cash_loan': return 'Cash loans'
    case 'subscription': return 'Subscriptions'
    case 'savings': return 'Savings'
    case 'lending': return 'Lending'
    default: return 'linked entry'
  }
}

export function useTransactionRefOptions(): TransactionRefOption[] {
  const [options, setOptions] = useState<TransactionRefOption[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [emi, jewel, cash, lendingDefault, lendingVijaya, subs, accounts] = await Promise.all([
          api.getEmi(),
          api.getJewelLoans(),
          api.getCashLoans(),
          api.getLending(LENDING_SHEET_SLUG_DEFAULT),
          api.getLending(LENDING_SHEET_SLUG_VIJAYA),
          api.getSubscriptionEntries(),
          api.getAccountsList(),
        ])
        if (cancelled) return
        const ongoing = (s?: string) => (s ?? 'Ongoing') !== 'Closed'
        setOptions([
          ...emi.filter(l => ongoing(l.status)).map(l => ({
            kind: 'emi_loan',
            id: l.id,
            label: l.name,
            group: 'EMI loans',
            // EMIs have no part payment, so the amount is known once the loan is.
            amount: Number(l.emi_amount) || undefined,
            types: ['Expense'] as const,
          })),
          ...jewel.filter(l => ongoing(l.status)).map(l => ({
            kind: 'jewel_loan',
            id: l.id,
            label: l.name,
            group: 'Jewel loans',
            types: ['Expense'] as const,
          })),
          ...cash.filter(l => ongoing(l.status)).map(l => ({
            kind: 'cash_loan',
            id: l.id,
            label: l.person_name,
            group: 'Cash loans',
            types: ['Expense'] as const,
          })),
          // People already in a lending book. Offering the existing list rather
          // than a text box is the whole point: a typo used to fork a balance
          // into two people who look identical on screen.
          ...lendingPeople(lendingDefault, LENDING_SHEET_SLUG_DEFAULT),
          ...lendingPeople(lendingVijaya, LENDING_SHEET_SLUG_VIJAYA),
          ...subs
            .filter(sub => (sub.status ?? 'active') === 'active')
            .map(sub => ({
              kind: 'subscription',
              id: sub.id,
              label: sub.name,
              group: 'Subscriptions',
              amount: Number(sub.amount) || undefined,
              types: ['Expense'] as const,
            })),
          ...savingsAccounts(accounts),
        ])
      } catch {
        // A link is an enhancement, never a blocker: without it the modal simply
        // hides the field and the transaction saves exactly as it always did.
        if (!cancelled) setOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return options
}

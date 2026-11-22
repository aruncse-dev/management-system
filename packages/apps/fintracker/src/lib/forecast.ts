/**
 * Where this cycle is heading, from what has happened so far.
 *
 * Deliberately simple and explainable: a straight-line projection of the
 * cycle's spend pace, compared with the budget and with the average income of
 * recent cycles. Every number shown can be checked by hand, which matters more
 * for a personal ledger than a cleverer model the owner cannot verify.
 */

export type CategoryPace = {
  name: string
  spent: number
  cap: number
  /** Spend projected to cycle end at the current pace. */
  projected: number
}

export type ForecastInput = {
  expense: number
  income: number
  totalBudget: number
  elapsedDays: number
  totalDays: number
  /** Categories with a budget cap. */
  categories: { name: string; spent: number; cap: number }[]
  /** Average income of recent cycles (0 when unknown). */
  avgIncome: number
  /** Renewals and premiums still to be paid before the cycle ends. */
  duesBeforeCycleEnd: number
}

export type Suggestion = { tone: 'red' | 'amber' | 'green' | 'muted'; title: string; detail: string }

export type Forecast = {
  /** Fewer than this many days in, a projection is mostly noise. */
  reliable: boolean
  daysLeft: number
  dailyPace: number
  projectedSpend: number
  /** What can still be spent per day to land on budget; null without a budget. */
  dailyAllowance: number | null
  /** Projected income (actual so far, or the recent average if higher) minus projected spend. */
  projectedNet: number
  atRisk: CategoryPace[]
  suggestions: Suggestion[]
}

export const MIN_DAYS_FOR_FORECAST = 3

export function forecastCycle(i: ForecastInput, fmt: (n: number) => string): Forecast {
  const elapsed = Math.max(0, Math.min(i.elapsedDays, i.totalDays))
  const daysLeft = Math.max(0, i.totalDays - elapsed)
  const dailyPace = elapsed > 0 ? i.expense / elapsed : 0
  const projectedSpend = i.expense + dailyPace * daysLeft
  const dailyAllowance =
    i.totalBudget > 0 ? Math.max(0, (i.totalBudget - i.expense) / Math.max(1, daysLeft)) : null
  // Income usually lands in one go; until it has, the recent average is the
  // better guess for the cycle.
  const expectedIncome = Math.max(i.income, i.avgIncome)
  const projectedNet = expectedIncome - projectedSpend - i.duesBeforeCycleEnd

  const frac = i.totalDays > 0 ? elapsed / i.totalDays : 1
  const atRisk: CategoryPace[] = i.categories
    .filter(c => c.cap > 0 && c.spent <= c.cap && frac > 0)
    .map(c => ({ ...c, projected: c.spent / frac }))
    .filter(c => c.projected > c.cap * 1.05)
    .sort((a, b) => b.projected / b.cap - a.projected / a.cap)
    .slice(0, 3)

  const reliable = elapsed >= MIN_DAYS_FOR_FORECAST
  const suggestions: Suggestion[] = []

  if (reliable && i.totalBudget > 0) {
    if (projectedSpend > i.totalBudget) {
      suggestions.push({
        tone: 'red',
        title: `On pace for ${fmt(projectedSpend)}, ${fmt(projectedSpend - i.totalBudget)} over budget`,
        detail:
          dailyAllowance && dailyAllowance > 0
            ? `Keep spending under ${fmt(dailyAllowance)} a day for the next ${daysLeft} days to land on ${fmt(i.totalBudget)}.`
            : `The budget of ${fmt(i.totalBudget)} is already used; every further spend adds to the overrun.`,
      })
    } else {
      suggestions.push({
        tone: 'green',
        title: `On track: about ${fmt(projectedSpend)} of ${fmt(i.totalBudget)}`,
        detail: `${fmt(dailyAllowance ?? 0)} a day left to spend for the next ${daysLeft} days.`,
      })
    }
  }

  for (const c of atRisk) {
    suggestions.push({
      tone: 'amber',
      title: `${c.name} is running fast`,
      detail: `${fmt(c.spent)} spent of ${fmt(c.cap)}; at this pace it reaches ${fmt(c.projected)} by cycle end.`,
    })
  }

  if (i.duesBeforeCycleEnd > 0) {
    suggestions.push({
      tone: 'muted',
      title: `${fmt(i.duesBeforeCycleEnd)} in renewals before the cycle ends`,
      detail: 'Already counted in the projected savings below — keep it aside.',
    })
  }

  if (reliable && expectedIncome > 0) {
    suggestions.push(
      projectedNet >= 0
        ? {
            tone: 'green',
            title: `Expected to save ${fmt(projectedNet)} this cycle`,
            detail: `${Math.round((projectedNet / expectedIncome) * 100)}% of income, after the dues still to come.`,
          }
        : {
            tone: 'red',
            title: `Heading ${fmt(-projectedNet)} short this cycle`,
            detail: 'Projected spend plus upcoming dues exceed expected income.',
          },
    )
  }

  return { reliable, daysLeft, dailyPace, projectedSpend, dailyAllowance, projectedNet, atRisk, suggestions }
}

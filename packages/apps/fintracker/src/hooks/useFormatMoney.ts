import { useCallback, useMemo } from 'react'
import {
  formatCurrency,
  currencySymbol,
  type SupportedCurrency,
} from '../../../../shared/utils/src/formatters'
import { useStore } from '../store'

function asSupportedCurrency(c: string): SupportedCurrency {
  const u = String(c || '').trim().toUpperCase()
  return u === 'USD' || u === 'AED' || u === 'INR' ? u : 'INR'
}

export type MoneyFormatting = {
  /** Format a number using Settings → display currency & round-off */
  format: (n: number) => string
  currency: SupportedCurrency
  roundOff: boolean
  symbol: string
  /** e.g. `$0` / `₹0` — use as input placeholder */
  zeroPlaceholder: string
}

/** Display currency, symbol, and formatters from org settings (store). */
export function useMoneyFormatting(): MoneyFormatting {
  const { state } = useStore()
  const currency = asSupportedCurrency(state.currency)
  const roundOff = state.roundOff
  const symbol = currencySymbol(currency)

  const format = useCallback((n: number) => formatCurrency(n, currency, roundOff), [currency, roundOff])

  const zeroPlaceholder = useMemo(
    () => formatCurrency(0, currency, roundOff),
    [currency, roundOff],
  )

  return useMemo(
    () => ({ format, currency, roundOff, symbol, zeroPlaceholder }),
    [format, currency, roundOff, symbol, zeroPlaceholder],
  )
}

/** Same as `useMoneyFormatting().format` — for call sites that only need the formatter. */
export function useFormatMoney(): (n: number) => string {
  const { format } = useMoneyFormatting()
  return format
}

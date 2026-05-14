import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, type AccountRow, type CreditSourceRow } from '../api'
import { mergeWriteSettingsPageCache, readSettingsPageCache } from '../lib/settingsPageCache'

export type FintrackerModesContextValue = {
  loading: boolean
  accounts: AccountRow[]
  creditSources: CreditSourceRow[]
  refresh: () => Promise<void>
  monthlyAccountNames: string[]
  savingsAccountNames: string[]
  creditCardNames: string[]
  informalCreditNames: string[]
  paymentModeOptions: string[]
  /** Transfer “to” dropdown — same as payment modes so any account or credit can receive a transfer. */
  transferTargetOptions: string[]
}

const FintrackerModesContext = createContext<FintrackerModesContextValue | null>(null)

function sortedActiveAccountNames(rows: AccountRow[], used: (u: string) => boolean): string[] {
  return rows
    .filter(a => a.isActive !== false && used(a.usedFor))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    .map(a => a.name)
}

function sortedActiveCreditNames(rows: CreditSourceRow[], category: string): string[] {
  return rows
    .filter(c => c.isActive !== false && c.category === category)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    .map(c => c.name)
}

export function FintrackerModesProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [creditSources, setCreditSources] = useState<CreditSourceRow[]>([])
  const [loading, setLoading] = useState(true)

  useLayoutEffect(() => {
    const c = readSettingsPageCache()
    if (!c) return
    setAccounts(c.accounts)
    setCreditSources(c.creditSources)
    setLoading(false)
  }, [])

  const refresh = useCallback(async (opts?: { background?: boolean }) => {
    if (!opts?.background) setLoading(true)
    try {
      const [a, c] = await Promise.all([api.getAccountsList(), api.getCreditSources()])
      setAccounts(a)
      setCreditSources(c)
      mergeWriteSettingsPageCache({ accounts: a, creditSources: c })
    } catch (e) {
      console.error('[FintrackerModes] accounts/credits load failed', e)
      if (!opts?.background) {
        setAccounts([])
        setCreditSources([])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const hadCache = readSettingsPageCache() != null
    void refresh({ background: hadCache })
  }, [refresh])

  const monthlyAccountNames = useMemo(
    () =>
      sortedActiveAccountNames(
        accounts,
        u => u === 'monthly' || u === 'both',
      ),
    [accounts],
  )

  const savingsAccountNames = useMemo(
    () =>
      sortedActiveAccountNames(
        accounts,
        u => u === 'savings' || u === 'both',
      ),
    [accounts],
  )

  const creditCardNames = useMemo(
    () => sortedActiveCreditNames(creditSources, 'credit_card'),
    [creditSources],
  )

  const informalCreditNames = useMemo(
    () => sortedActiveCreditNames(creditSources, 'informal'),
    [creditSources],
  )

  const paymentModeOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const n of [...monthlyAccountNames, ...creditCardNames, ...informalCreditNames]) {
      if (!seen.has(n)) {
        seen.add(n)
        out.push(n)
      }
    }
    return out
  }, [monthlyAccountNames, creditCardNames, informalCreditNames])

  const value = useMemo(
    (): FintrackerModesContextValue => ({
      loading,
      accounts,
      creditSources,
      refresh,
      monthlyAccountNames,
      savingsAccountNames,
      creditCardNames,
      informalCreditNames,
      paymentModeOptions,
      transferTargetOptions: paymentModeOptions,
    }),
    [
      loading,
      accounts,
      creditSources,
      refresh,
      monthlyAccountNames,
      savingsAccountNames,
      creditCardNames,
      informalCreditNames,
      paymentModeOptions,
    ],
  )

  return <FintrackerModesContext.Provider value={value}>{children}</FintrackerModesContext.Provider>
}

export function useFintrackerModes(): FintrackerModesContextValue {
  const ctx = useContext(FintrackerModesContext)
  if (!ctx) {
    throw new Error('useFintrackerModes must be used within FintrackerModesProvider')
  }
  return ctx
}

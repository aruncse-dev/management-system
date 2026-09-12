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
  /** Transfer “to” dropdown: payment modes plus savings accounts, so a savings deposit is expressible. */
  transferTargetOptions: string[]
}

const FintrackerModesContext = createContext<FintrackerModesContextValue | null>(null)

function sortedActiveAccountNames(rows: AccountRow[], used: (u: string) => boolean): string[] {
  return rows
    // A closed account keeps its history and its balance, but nothing new should
    // be sent there — so it leaves the pickers while staying on the page.
    .filter(a => a.isActive !== false && !a.closedOn && used(a.usedFor))
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

  /**
   * Transfer destinations: payment sources **plus** savings accounts.
   *
   * These used to be the same list, which excluded `used_for = 'savings'` — so
   * an RD contribution or a move into a savings pot was not even expressible as
   * a transfer. Money left the source account and arrived nowhere, and the
   * dashboard simply lost it.
   */
  const transferTargetOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const n of [...paymentModeOptions, ...savingsAccountNames]) {
      if (!seen.has(n)) {
        seen.add(n)
        out.push(n)
      }
    }
    return out
  }, [paymentModeOptions, savingsAccountNames])

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
      transferTargetOptions,
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
      transferTargetOptions,
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

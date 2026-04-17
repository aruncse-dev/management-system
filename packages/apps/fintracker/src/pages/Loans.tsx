import { useEffect, useMemo, useState } from 'react'
import { Banknote, BarChart3, CreditCard, Landmark, Clock, Layers3, ArrowDownLeft, ArrowUpRight, Plus } from 'lucide-react'
import { api, RawCashLoanHistoryRow, RawCashLoanRow, RawEmiRow, RawJewelLoanHistoryRow, RawJewelLoanRow } from '../api'
import { INR } from '@fintracker-vault/utils'
import { FormField, HoldingCard, KpiCard, LoadingState, ModalActions, ModalShell, SectionBlock, SectionChip, TabBar } from '@fintracker-vault/ui'

type LoanSource = 'EMI' | 'Jewel' | 'Cash'
type LoansTab = 'dashboard' | 'emi' | 'jewel' | 'cash' | 'history'

type CombinedLoan =
  | { kind: 'EMI'; id: string; name: string; bank: string; principal: number; rate: number; tenure_months: number; emi_amount: number; paid_emis: number; interest: number; paid: number; outstanding: number; startDate: string; endDate: string; status: string }
  | { kind: 'Jewel'; id: string; name: string; bank: string; principal: number; interest: number; paid: number; outstanding: number; startDate: string; endDate: string; status: string }
  | { kind: 'Cash'; id: string; name: string; bank?: string; principal: number; paid: number; outstanding: number; startDate: string; status: string }

type CombinedHistoryRow = {
  id: string
  source: LoanSource
  kind: 'Loan' | 'Payment'
  title: string
  subtitle: string
  date: string
  amount: number
  tone: 'navy' | 'green' | 'red' | 'amber'
  sourceLoanId?: string
  sourcePaymentId?: string
}

interface EmiFormState {
  name: string
  bank: string
  principal: string
  rate: string
  start_date: string
  tenure_months: string
  emi_amount: string
  paid_emis: string
}

interface JewelFormState {
  name: string
  bank: string
  principal: string
  rate: string
  start_date: string
  end_date: string
  paid_amount: string
}

interface CashFormState {
  person_name: string
  amount_received: string
  start_date: string
  paid_amount: string
}

interface PaymentFormState {
  loan_id: string
  date: string
  amount: string
  note: string
}

function parseNumber(value: number | string) {
  const n = parseFloat(String(value))
  return isNaN(n) ? 0 : n
}

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN)
  const cleanDate = dateStr.split('T')[0]
  const dmmy = cleanDate.match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/)
  if (dmmy) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    const monthIndex = months.indexOf(dmmy[2].toLowerCase())
    if (monthIndex !== -1) return new Date(Date.UTC(2000 + parseInt(dmmy[3]), monthIndex, parseInt(dmmy[1])))
  }
  const ymd = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymd) return new Date(Date.UTC(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3])))
  return new Date(NaN)
}

function normalizeDateForInput(dateStr: string) {
  const cleanDate = String(dateStr ?? '').trim().split('T')[0]
  const ymd = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`

  const dmmy = cleanDate.match(/^(\d{2})-([A-Za-z]{3})-(\d{2})$/)
  if (dmmy) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    const monthIndex = months.indexOf(dmmy[2].toLowerCase())
    if (monthIndex !== -1) {
      return `${String(2000 + parseInt(dmmy[3])).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${dmmy[1]}`
    }
  }

  const parsed = new Date(cleanDate)
  if (!isNaN(parsed.getTime())) {
    const y = String(parsed.getUTCFullYear()).padStart(4, '0')
    const m = String(parsed.getUTCMonth() + 1).padStart(2, '0')
    const d = String(parsed.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return new Date().toISOString().split('T')[0]
}

function fmtDate(dateStr: string) {
  const date = parseDate(dateStr)
  if (isNaN(date.getTime())) return ''
  const d = String(date.getUTCDate()).padStart(2, '0')
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()]
  const y = String(date.getUTCFullYear()).slice(2)
  return `${d}-${m}-${y}`
}

function formatDateForInput(dateStr: string) {
  return normalizeDateForInput(dateStr)
}

function addMonths(dateStr: string, months: number): string {
  const date = parseDate(dateStr)
  date.setMonth(date.getMonth() + months)
  const y = String(date.getFullYear()).padStart(4, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function calculateEMI(principal: number, annualRate: number, tenure: number): number {
  if (principal <= 0 || tenure <= 0 || annualRate < 0) return 0
  const monthlyRate = annualRate / 12 / 100
  if (monthlyRate === 0) return principal / tenure
  const pow = Math.pow(1 + monthlyRate, tenure)
  if (!isFinite(pow)) return 0
  const numerator = monthlyRate * pow
  const denominator = pow - 1
  if (denominator === 0) return principal / tenure
  const emi = (principal * numerator) / denominator
  return isFinite(emi) ? emi : 0
}

function emptyEmiForm(): EmiFormState {
  return {
    name: '',
    bank: '',
    principal: '',
    rate: '',
    start_date: new Date().toISOString().split('T')[0],
    tenure_months: '',
    emi_amount: '',
    paid_emis: '0',
  }
}

function emptyJewelForm(): JewelFormState {
  return {
    name: '',
    bank: '',
    principal: '',
    rate: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    paid_amount: '0',
  }
}

function emptyCashForm(): CashFormState {
  return {
    person_name: '',
    amount_received: '',
    start_date: new Date().toISOString().split('T')[0],
    paid_amount: '0',
  }
}

function emptyPaymentForm(): PaymentFormState {
  return {
    loan_id: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    note: '',
  }
}

function buildEmiLoans(rows: RawEmiRow[]): CombinedLoan[] {
  return rows.map(raw => {
    const principal = parseNumber(raw.principal)
    const rate = parseNumber(raw.rate)
    const tenure_months = parseNumber(raw.tenure_months)
    const emi_amount = parseNumber(raw.emi_amount)
    const paidEmis = parseNumber(raw.paid_emis)
    const totalPayable = Math.round(emi_amount * tenure_months)
    const interest = Math.max(totalPayable - principal, 0)
    const paid = Math.round(emi_amount * paidEmis)
    return {
      kind: 'EMI' as const,
      id: raw.id,
      name: String(raw.name ?? '').trim(),
      bank: String(raw.bank ?? '').trim(),
      principal,
      rate,
      tenure_months,
      emi_amount,
      paid_emis: paidEmis,
      interest,
      paid,
      outstanding: totalPayable - paid,
      startDate: String(raw.start_date ?? ''),
      endDate: addMonths(String(raw.start_date ?? ''), tenure_months),
      status: String(raw.status ?? 'Ongoing').trim(),
    }
  })
}

function buildJewelLoans(rows: RawJewelLoanRow[]): CombinedLoan[] {
  return rows.map(raw => {
    const principal = parseNumber(raw.principal)
    const rate = parseNumber(raw.rate)
    const paid = Math.round(parseNumber(raw.paid_amount))
    const totalPayable = Math.round(principal * (1 + rate / 100))
    const interest = Math.max(totalPayable - principal, 0)
    return {
      kind: 'Jewel' as const,
      id: raw.id,
      name: String(raw.name ?? '').trim(),
      bank: String(raw.bank ?? '').trim(),
      principal,
      interest,
      paid,
      outstanding: totalPayable - paid,
      startDate: String(raw.start_date ?? ''),
      endDate: String(raw.end_date ?? ''),
      status: String(raw.status ?? 'Ongoing').trim(),
    }
  })
}

function buildCashLoans(rows: RawCashLoanRow[]): CombinedLoan[] {
  return rows.map(raw => {
    const principal = parseNumber(raw.amount_received)
    const paid = Math.round(parseNumber(raw.paid_amount))
    return {
      kind: 'Cash' as const,
      id: raw.id,
      name: String(raw.person_name ?? '').trim(),
      principal,
      paid,
      outstanding: principal - paid,
      startDate: String(raw.start_date ?? ''),
      endDate: '',
      status: 'Ongoing',
    }
  })
}

function buildHistory(
  jewelHistory: RawJewelLoanHistoryRow[],
  cashHistory: RawCashLoanHistoryRow[],
): CombinedHistoryRow[] {
  const rows: CombinedHistoryRow[] = []

  jewelHistory.forEach(raw => {
    rows.push({
      id: `jewel-pay-${raw.id}`,
      source: 'Jewel',
      kind: 'Payment',
      title: `Repayment`,
      subtitle: String(raw.note ?? '').trim() || 'Jewel Loan',
      date: String(raw.date ?? ''),
      amount: parseNumber(raw.amount),
      tone: 'green',
      sourceLoanId: raw.loan_id,
      sourcePaymentId: raw.id,
    })
  })

  cashHistory.forEach(raw => {
    rows.push({
      id: `cash-pay-${raw.id}`,
      source: 'Cash',
      kind: 'Payment',
      title: 'Repayment',
      subtitle: String(raw.note ?? '').trim() || 'Cash Loan',
      date: String(raw.date ?? ''),
      amount: parseNumber(raw.amount),
      tone: 'green',
      sourceLoanId: raw.loan_id,
      sourcePaymentId: raw.id,
    })
  })

  return rows.sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())
}

export default function Loans() {
  const [activeTab, setActiveTab] = useState<LoansTab>('dashboard')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [emiModalOpen, setEmiModalOpen] = useState(false)
  const [emiEditItem, setEmiEditItem] = useState<CombinedLoan | null>(null)
  const [emiForm, setEmiForm] = useState<EmiFormState>(emptyEmiForm())
  const [emiSaving, setEmiSaving] = useState(false)
  const [emiManuallyEdited, setEmiManuallyEdited] = useState(false)
  const [jewelModalOpen, setJewelModalOpen] = useState(false)
  const [jewelEditItem, setJewelEditItem] = useState<Extract<CombinedLoan, { kind: 'Jewel' }> | null>(null)
  const [jewelForm, setJewelForm] = useState<JewelFormState>(emptyJewelForm())
  const [jewelSaving, setJewelSaving] = useState(false)
  const [cashModalOpen, setCashModalOpen] = useState(false)
  const [cashEditItem, setCashEditItem] = useState<Extract<CombinedLoan, { kind: 'Cash' }> | null>(null)
  const [cashForm, setCashForm] = useState<CashFormState>(emptyCashForm())
  const [cashSaving, setCashSaving] = useState(false)
  const [repayModalOpen, setRepayModalOpen] = useState(false)
  const [repaySaving, setRepaySaving] = useState(false)
  const [repayForm, setRepayForm] = useState<PaymentFormState>(emptyPaymentForm())
  const [repayType, setRepayType] = useState<'jewel' | 'cash'>('jewel')
  const [repayEditItem, setRepayEditItem] = useState<CombinedHistoryRow | null>(null)
  const fabStyle = {
    position: 'fixed' as const,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 110,
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.22)',
  }

  const [emiLoans, setEmiLoans] = useState<CombinedLoan[]>([])
  const [jewelLoans, setJewelLoans] = useState<CombinedLoan[]>([])
  const [cashLoans, setCashLoans] = useState<CombinedLoan[]>([])
  const [jewelHistory, setJewelHistory] = useState<RawJewelLoanHistoryRow[]>([])
  const [cashHistory, setCashHistory] = useState<RawCashLoanHistoryRow[]>([])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [emiRows, jewelRows, jewelPayments, cashRows, cashPayments] = await Promise.all([
        api.getEmi(),
        api.getJewelLoans(),
        api.getJewelLoanHistory(),
        api.getCashLoans(),
        api.getCashLoanHistory(),
      ])

      setEmiLoans(buildEmiLoans(emiRows))
      setJewelLoans(buildJewelLoans(jewelRows))
      setCashLoans(buildCashLoans(cashRows))
      setJewelHistory(jewelPayments)
      setCashHistory(cashPayments)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load loans')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const allLoans = useMemo(() => [...emiLoans, ...jewelLoans, ...cashLoans], [emiLoans, jewelLoans, cashLoans])
  const history = useMemo(() => buildHistory(jewelHistory, cashHistory), [jewelHistory, cashHistory])

  const emiRows = useMemo(
    () => emiLoans.filter((loan): loan is Extract<CombinedLoan, { kind: 'EMI' }> => loan.kind === 'EMI'),
    [emiLoans],
  )

  const jewelRows = useMemo(
    () => jewelLoans.filter((loan): loan is Extract<CombinedLoan, { kind: 'Jewel' }> => loan.kind === 'Jewel'),
    [jewelLoans],
  )

  const cashRows = useMemo(
    () => cashLoans.filter((loan): loan is Extract<CombinedLoan, { kind: 'Cash' }> => loan.kind === 'Cash'),
    [cashLoans],
  )

  const metrics = useMemo(() => {
    const totalPrincipal = Math.round(allLoans.reduce((sum, loan) => sum + loan.principal, 0))
    const totalPaid = Math.round(allLoans.reduce((sum, loan) => sum + loan.paid, 0))
    const totalInterest = Math.round(
      emiRows.reduce((sum, loan) => sum + loan.interest, 0) +
      jewelRows.reduce((sum, loan) => sum + loan.interest, 0),
    )
    const totalOutstanding = Math.round(allLoans.reduce((sum, loan) => sum + loan.outstanding, 0))
    return {
      totalPrincipal,
      totalInterest,
      totalLoanAmount: totalPrincipal + totalInterest,
      totalPaid,
      totalOutstanding,
      loanCount: allLoans.length,
      emiCount: emiRows.length,
      jewelCount: jewelRows.length,
      cashCount: cashRows.length,
    }
  }, [allLoans, emiRows, jewelRows, cashRows])

  const emiMetrics = useMemo(() => {
    const ongoingLoans = emiRows.filter(l => l.status === 'Ongoing')
    const totalLoanCount = emiRows.length
    const totalOutstanding = Math.round(ongoingLoans.reduce((s, l) => {
      const totalPayable = l.emi_amount * l.tenure_months
      const totalPaid = l.emi_amount * l.paid_emis
      return s + (totalPayable - totalPaid)
    }, 0))
    const totalLoanValue = Math.round(emiRows.reduce((s, l) => s + (l.emi_amount * l.tenure_months), 0))
    const totalMonthlyEmis = Math.round(ongoingLoans.reduce((s, l) => s + l.emi_amount, 0))
    return { totalLoanCount, totalOutstanding, totalLoanValue, totalMonthlyEmis }
  }, [emiRows])

  const filteredHistory = history

  const tabs = [
    { id: 'dashboard' as const, icon: <BarChart3 size={19} />, label: 'Dashboard' },
    { id: 'emi' as const, icon: <CreditCard size={19} />, label: 'EMI Loans' },
    { id: 'jewel' as const, icon: <Landmark size={19} />, label: 'Jewel Loans' },
    { id: 'cash' as const, icon: <Banknote size={19} />, label: 'Cash Loans' },
    { id: 'history' as const, icon: <Clock size={19} />, label: 'Repayments' },
  ]

  const jewelMetrics = useMemo(() => {
    const totalPrincipal = Math.round(jewelRows.reduce((sum, loan) => sum + loan.principal, 0))
    const totalInterest = Math.round(jewelRows.reduce((sum, loan) => sum + loan.interest, 0))
    const totalPaid = Math.round(jewelRows.reduce((sum, loan) => sum + loan.paid, 0))
    const totalOutstanding = Math.round(jewelRows.reduce((sum, loan) => sum + loan.outstanding, 0))
    return {
      totalPrincipal,
      totalInterest,
      totalPaid,
      totalOutstanding,
      count: jewelRows.length,
    }
  }, [jewelRows])

  function setEmiField<K extends keyof EmiFormState>(k: K, v: EmiFormState[K]) {
    setEmiForm(f => ({ ...f, [k]: v }))
    if (k === 'emi_amount') setEmiManuallyEdited(true)
  }

  function openAddEmi() {
    setEmiEditItem(null)
    setEmiForm(emptyEmiForm())
    setEmiManuallyEdited(false)
    setEmiModalOpen(true)
  }

  function openEditEmi(loan: Extract<CombinedLoan, { kind: 'EMI' }>) {
    setEmiEditItem(loan)
    setEmiForm({
      name: loan.name,
      bank: loan.bank,
      principal: String(loan.principal),
      rate: '0',
      start_date: formatDateForInput(loan.startDate),
      tenure_months: String(loan.tenure_months),
      emi_amount: String(loan.emi_amount),
      paid_emis: String(loan.paid_emis),
    })
    setEmiManuallyEdited(true)
    setEmiModalOpen(true)
  }

  function openAddJewel() {
    setJewelEditItem(null)
    setJewelForm(emptyJewelForm())
    setJewelModalOpen(true)
  }

  function openEditJewel(loan: Extract<CombinedLoan, { kind: 'Jewel' }>) {
    setJewelEditItem(loan)
    setJewelForm({
      name: loan.name,
      bank: loan.bank,
      principal: String(loan.principal),
      rate: '0',
      start_date: formatDateForInput(loan.startDate),
      end_date: formatDateForInput(loan.endDate),
      paid_amount: String(loan.paid),
    })
    setJewelModalOpen(true)
  }

  function closeJewelModal() {
    setJewelModalOpen(false)
    setJewelEditItem(null)
    setJewelForm(emptyJewelForm())
    setJewelSaving(false)
  }

  async function saveJewel() {
    if (!jewelForm.name.trim() || !jewelForm.bank.trim() || !jewelForm.principal) return
    setJewelSaving(true)
    const payload = {
      name: jewelForm.name.trim(),
      bank: jewelForm.bank.trim(),
      principal: parseFloat(jewelForm.principal),
      rate: parseFloat(jewelForm.rate) || 0,
      start_date: jewelForm.start_date,
      end_date: jewelForm.end_date,
      paid_amount: parseFloat(jewelForm.paid_amount) || 0,
      status: 'Ongoing',
    }
    try {
      if (jewelEditItem) await api.updateJewelLoan({ ...payload, id: jewelEditItem.id })
      else await api.addJewelLoan(payload)
      api.invalidateCache({ action: 'getEntries', params: { module: 'loans', type: 'jewel' } })
      closeJewelModal()
      await loadData()
    } finally {
      setJewelSaving(false)
    }
  }

  async function deleteJewelLoan() {
    if (!jewelEditItem || !window.confirm('Delete this jewel loan?')) return
    setJewelSaving(true)
    try {
      await api.deleteJewelLoan(jewelEditItem.id)
      api.invalidateCache({ action: 'getEntries', params: { module: 'loans', type: 'jewel' } })
      closeJewelModal()
      await loadData()
    } finally {
      setJewelSaving(false)
    }
  }

  function openAddCash() {
    setCashEditItem(null)
    setCashForm(emptyCashForm())
    setCashModalOpen(true)
  }

  function openEditCash(loan: Extract<CombinedLoan, { kind: 'Cash' }>) {
    setCashEditItem(loan)
    setCashForm({
      person_name: loan.name,
      amount_received: String(loan.principal),
      start_date: formatDateForInput(loan.startDate),
      paid_amount: String(loan.paid),
    })
    setCashModalOpen(true)
  }

  function closeCashModal() {
    setCashModalOpen(false)
    setCashEditItem(null)
    setCashForm(emptyCashForm())
    setCashSaving(false)
  }

  async function saveCash() {
    if (!cashForm.person_name.trim() || !cashForm.amount_received) return
    setCashSaving(true)
    const payload = {
      person_name: cashForm.person_name.trim(),
      amount_received: parseFloat(cashForm.amount_received),
      start_date: cashForm.start_date,
      paid_amount: parseFloat(cashForm.paid_amount) || 0,
    }
    try {
      if (cashEditItem) await api.updateCashLoan({ ...payload, id: cashEditItem.id })
      else await api.addCashLoan(payload)
      api.invalidateCache({ action: 'getEntries', params: { module: 'loans', type: 'cash' } })
      closeCashModal()
      await loadData()
    } finally {
      setCashSaving(false)
    }
  }

  async function deleteCashLoan() {
    if (!cashEditItem || !window.confirm('Delete this cash loan?')) return
    setCashSaving(true)
    try {
      await api.deleteCashLoan(cashEditItem.id)
      api.invalidateCache({ action: 'getEntries', params: { module: 'loans', type: 'cash' } })
      closeCashModal()
      await loadData()
    } finally {
      setCashSaving(false)
    }
  }

  function openRepayment() {
    const activeLoans = repayType === 'jewel' ? jewelRows : cashLoans
    setRepayForm({
      loan_id: activeLoans[0]?.id ?? '',
      date: new Date().toISOString().split('T')[0],
      amount: '',
      note: '',
    })
    setRepayEditItem(null)
    setRepayModalOpen(true)
  }

  function openHistoryEdit(row: CombinedHistoryRow) {
    if (row.kind === 'Payment' && row.sourcePaymentId) {
      setRepayType(row.source === 'Cash' ? 'cash' : 'jewel')
      setRepayEditItem(row)
      setRepayForm({
        loan_id: row.sourceLoanId ?? '',
        date: normalizeDateForInput(row.date),
        amount: String(row.amount),
        note: row.subtitle,
      })
      setRepayModalOpen(true)
    }
  }

  function closeRepayment() {
    setRepayModalOpen(false)
    setRepayForm(emptyPaymentForm())
    setRepaySaving(false)
    setRepayEditItem(null)
  }

  async function saveRepayment() {
    if (!repayForm.loan_id || !repayForm.amount) return
    setRepaySaving(true)
    const payload = {
      loan_id: repayForm.loan_id,
      date: repayForm.date,
      amount: parseFloat(repayForm.amount),
      note: repayForm.note.trim(),
    }
    try {
      if (repayEditItem?.sourcePaymentId) {
        if (repayType === 'jewel') await api.updateJewelLoanHistory({ ...payload, id: repayEditItem.sourcePaymentId })
        else {
          await api.deleteCashLoanHistory(repayEditItem.sourcePaymentId)
          await api.addCashLoanHistory(payload)
        }
      } else if (repayType === 'jewel') await api.addJewelLoanHistory(payload)
      else await api.addCashLoanHistory(payload)
      api.invalidateCache({ action: 'getHistory', params: { module: 'loans', type: repayType } })
      setRepayEditItem(null)
      closeRepayment()
      await loadData()
    } finally {
      setRepaySaving(false)
    }
  }

  async function deleteRepayment() {
    if (!repayEditItem?.sourcePaymentId || !window.confirm('Delete this repayment?')) return
    setRepaySaving(true)
    try {
      if (repayType === 'cash') await api.deleteCashLoanHistory(repayEditItem.sourcePaymentId)
      else await api.deleteJewelLoanHistory(repayEditItem.sourcePaymentId)
      api.invalidateCache({ action: 'getHistory', params: { module: 'loans', type: repayType } })
      closeRepayment()
      await loadData()
    } finally {
      setRepaySaving(false)
    }
  }

  function closeEmiModal() {
    setEmiModalOpen(false)
    setEmiEditItem(null)
    setEmiForm(emptyEmiForm())
    setEmiSaving(false)
    setEmiManuallyEdited(false)
  }

  useEffect(() => {
    const principal = parseFloat(emiForm.principal) || 0
    const rate = parseFloat(emiForm.rate) || 0
    const tenure = parseFloat(emiForm.tenure_months) || 0
    if (principal > 0 && tenure > 0 && !emiManuallyEdited) {
      const calculatedEmi = calculateEMI(principal, rate, tenure)
      setEmiForm(f => ({ ...f, emi_amount: String(Math.round(calculatedEmi)) }))
    }
  }, [emiForm.principal, emiForm.rate, emiForm.tenure_months, emiManuallyEdited])

  async function saveEmi() {
    if (!emiForm.name.trim() || !emiForm.bank.trim() || !emiForm.principal || !emiForm.tenure_months || !emiForm.emi_amount) return
    setEmiSaving(true)
    const payload = {
      name: emiForm.name.trim(),
      bank: emiForm.bank.trim(),
      principal: parseFloat(emiForm.principal),
      rate: parseFloat(emiForm.rate) || 0,
      start_date: emiForm.start_date,
      tenure_months: parseFloat(emiForm.tenure_months),
      emi_amount: parseFloat(emiForm.emi_amount),
      paid_emis: parseFloat(emiForm.paid_emis) || 0,
      status: 'Ongoing',
    }
    try {
      if (emiEditItem) await api.updateEmi({ ...payload, id: emiEditItem.id })
      else await api.addEmi(payload)
      api.invalidateCache({ action: 'getEntries', params: { module: 'loans' } })
      closeEmiModal()
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setEmiSaving(false)
    }
  }

  async function deleteEmiLoan() {
    if (!emiEditItem || !window.confirm('Delete this EMI loan?')) return
    setEmiSaving(true)
    try {
      await api.deleteEmi(emiEditItem.id)
      api.invalidateCache({ action: 'getEntries', params: { module: 'loans' } })
      closeEmiModal()
      await loadData()
    } finally {
      setEmiSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="ui-kit-page-shell" style={{ paddingLeft: 8, paddingRight: 8 }}>
        <TabBar tabs={tabs} active={activeTab} onChange={id => setActiveTab(id as LoansTab)} />
        <LoadingState />
      </div>
    )
  }

  return (
    <div className="ui-kit-page-shell" style={{ paddingLeft: 8, paddingRight: 8 }}>
      <TabBar tabs={tabs} active={activeTab} onChange={id => setActiveTab(id as LoansTab)} />
      <div style={{ paddingTop: 0, paddingBottom: 0 }}>
        {activeTab === 'dashboard' && (
          <SectionBlock
            title="Loans Dashboard"
            icon={<Layers3 size={14} />}
            right={<SectionChip tone="muted">{metrics.loanCount} loans</SectionChip>}
          >
            <div className="dash-grid">
              <KpiCard label="Total Outstanding" value={<span className="kpi-card-v--red">{INR(metrics.totalOutstanding)}</span>} tone="red" icon={<ArrowUpRight size={14} />} full />
              <KpiCard label="Total Loan Amount" value={INR(metrics.totalLoanAmount)} tone="navy" icon={<CreditCard size={14} />} full />
              <KpiCard label="Total Principal" value={INR(metrics.totalPrincipal)} tone="muted" icon={<CreditCard size={14} />} />
              <KpiCard label="Total Interest" value={INR(metrics.totalInterest)} tone="amber" icon={<Landmark size={14} />} />
              <KpiCard label="Total Paid" value={INR(metrics.totalPaid)} tone="green" icon={<ArrowDownLeft size={14} />} />
              <KpiCard label="EMI Loans" value={emiMetrics.totalLoanCount} tone="muted" icon={<CreditCard size={14} />} />
              <KpiCard label="Jewel Loans" value={jewelMetrics.count} tone="muted" icon={<Landmark size={14} />} />
              <KpiCard label="Cash Loans" value={cashLoans.length} tone="muted" icon={<Banknote size={14} />} />
            </div>
          </SectionBlock>
        )}

        {activeTab === 'emi' && (
          <>
            <SectionBlock
              title="Metrics"
              icon={<BarChart3 size={14} />}
              right={<SectionChip tone="muted">{emiMetrics.totalLoanCount} loans</SectionChip>}
            >
              <div className="dash-grid">
                <KpiCard label="Loan Value" value={INR(emiMetrics.totalLoanValue)} tone="navy" icon={<CreditCard size={14} />} />
                <KpiCard label="Principal" value={INR(emiRows.reduce((sum, loan) => sum + loan.principal, 0))} tone="navy" icon={<CreditCard size={14} />} />
                <KpiCard label="Interest" value={INR(emiRows.reduce((sum, loan) => sum + loan.interest, 0))} tone="amber" icon={<Landmark size={14} />} />
                <KpiCard label="Paid" value={INR(emiRows.reduce((sum, loan) => sum + (loan.emi_amount * loan.paid_emis), 0))} tone="muted" icon={<Banknote size={14} />} />
                <KpiCard label="Outstanding" value={<span className="kpi-card-v--red">{INR(emiMetrics.totalOutstanding)}</span>} tone="red" icon={<ArrowUpRight size={14} />} />
                <KpiCard label="Monthly EMIs" value={INR(emiMetrics.totalMonthlyEmis)} tone="green" icon={<ArrowDownLeft size={14} />} />
              </div>
            </SectionBlock>

            <SectionBlock
              title="EMI Loans"
              icon={<CreditCard size={14} />}
              right={<SectionChip tone="muted">{emiMetrics.totalLoanCount} loans</SectionChip>}
            >
              {emiRows.length === 0 ? (
                <p style={{ color: 'var(--muted)', padding: '0.5rem 0', fontSize: 14 }}>No EMI loans yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 8 }}>
                  {emiRows.map(loan => {
                    const totalPayable = loan.emi_amount * loan.tenure_months
                    const outstanding = totalPayable - loan.emi_amount * loan.paid_emis
                    const paid = loan.emi_amount * loan.paid_emis
                    const remainingMonths = Math.max(loan.tenure_months - loan.paid_emis, 0)
                    return (
                      <div
                        key={loan.id}
                        className={`ui-kit-holding-card${loan.status === 'Ongoing' ? ' ui-kit-holding-card--accent-red' : ''} stock-entry-card`}
                        onClick={() => openEditEmi(loan)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') openEditEmi(loan)
                        }}
                      >
                        <div className="ui-kit-holding-card-head">
                          <div>
                            <div className="ui-kit-holding-card-title">
                              <span>{loan.name}</span>
                            </div>
                            <div className="ui-kit-holding-card-subtitle">{loan.bank}</div>
                          </div>
                          <div className="ui-kit-holding-card-head-right">
                            <div className="ui-kit-holding-icon ui-kit-holding-icon--bg ui-tone-red">
                              <CreditCard size={14} />
                            </div>
                          </div>
                        </div>

                        <div className="ui-kit-holding-card-grid">
                          <div className="ui-kit-holding-stat">
                            <span>Paid EMIs</span>
                            <strong>{`${loan.paid_emis}/${loan.tenure_months}`}</strong>
                          </div>
                          <div className="ui-kit-holding-stat ui-kit-holding-stat--center">
                            <span>Principal</span>
                            <strong>{INR(loan.principal)}</strong>
                          </div>
                          <div className="ui-kit-holding-stat ui-kit-holding-stat--right">
                            <span>Amount Paid</span>
                            <strong>{INR(paid)}</strong>
                          </div>
                        </div>

                        <div className="ui-kit-holding-card-grid">
                          <div className="ui-kit-holding-stat">
                            <span>Interest Rate</span>
                            <strong>{`${loan.rate}%`}</strong>
                          </div>
                          <div className="ui-kit-holding-stat ui-kit-holding-stat--center">
                            <span>Monthly EMI</span>
                            <strong>{INR(loan.emi_amount)}</strong>
                          </div>
                          <div className="ui-kit-holding-stat ui-kit-holding-stat--right">
                            <span>Tenure Left</span>
                            <strong>{`${remainingMonths} months`}</strong>
                          </div>
                        </div>

                        <div className="ui-kit-holding-pnl ui-tone-red">
                          <div className="ui-kit-holding-pnl-row">
                            <div className="ui-kit-holding-pnl-label">Outstanding</div>
                            <div className="ui-kit-holding-pnl-value">{INR(outstanding)}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </SectionBlock>
          </>
        )}

        {activeTab === 'history' && (
          <SectionBlock
            title="Repayments"
            icon={<Clock size={14} />}
            right={<SectionChip tone="muted">{filteredHistory.length}</SectionChip>}
          >
            {error ? (
              <p style={{ color: '#EF4444', fontSize: 13, padding: '0.5rem 0' }}>⚠ {error}</p>
            ) : filteredHistory.length === 0 ? (
              <p style={{ color: 'var(--muted)', padding: '0.5rem 0', fontSize: 14 }}>No repayments yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {filteredHistory.map(row => (
                  <HoldingCard
                    key={row.id}
                    title={row.title}
                    subtitle={row.subtitle}
                    leftLabel="Amount"
                    leftValue={INR(row.amount)}
                    centerLabel="Type"
                    centerValue={row.source}
                    rightLabel="Date"
                    rightValue={fmtDate(row.date)}
                    accentTone={row.tone}
                    icon={row.kind === 'Payment' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                    iconPosition="right"
                    iconBackground
                    className="stock-entry-card"
                    onClick={row.kind === 'Payment' ? () => openHistoryEdit(row) : undefined}
                  />
                ))}
              </div>
            )}
          </SectionBlock>
        )}

        {activeTab === 'jewel' && (
          <>
            <SectionBlock
              title="Metrics"
              icon={<Landmark size={14} />}
              right={<SectionChip tone="muted">{jewelMetrics.count} loans</SectionChip>}
            >
              <div className="dash-grid">
                <KpiCard label="Principal" value={INR(jewelMetrics.totalPrincipal)} tone="navy" icon={<CreditCard size={14} />} />
                <KpiCard label="Paid" value={INR(jewelMetrics.totalPaid)} tone="green" icon={<ArrowDownLeft size={14} />} />
                <KpiCard label="Outstanding" value={<span className="kpi-card-v--red">{INR(jewelMetrics.totalOutstanding)}</span>} tone="red" icon={<ArrowUpRight size={14} />} />
                <KpiCard label="Interest" value={INR(jewelMetrics.totalInterest)} tone="amber" icon={<Landmark size={14} />} />
              </div>
            </SectionBlock>

            <SectionBlock
              title="Jewel Loans"
              icon={<Landmark size={14} />}
              right={<SectionChip tone="muted">{jewelMetrics.count} loans</SectionChip>}
            >
              {jewelRows.length === 0 ? (
                <p style={{ color: 'var(--muted)', padding: '0.5rem 0', fontSize: 14 }}>No loans yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 8 }}>
                  {jewelRows.map(loan => {
                    const jewelLoan = loan as Extract<CombinedLoan, { kind: 'Jewel' }>
                    const totalPayable = jewelLoan.principal + jewelLoan.interest
                    return (
                      <div
                        key={jewelLoan.id}
                        className={`ui-kit-holding-card${jewelLoan.status === 'Ongoing' ? ' ui-kit-holding-card--accent-amber' : ''} stock-entry-card`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openEditJewel(jewelLoan)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') openEditJewel(jewelLoan)
                        }}
                      >
                        <div className="ui-kit-holding-card-head">
                          <div>
                            <div className="ui-kit-holding-card-title">
                              <span>{jewelLoan.name}</span>
                            </div>
                            <div className="ui-kit-holding-card-subtitle">{jewelLoan.bank}</div>
                          </div>
                          <div className="ui-kit-holding-card-head-right">
                            <div className="ui-kit-holding-icon ui-kit-holding-icon--bg ui-tone-amber">
                              <Landmark size={14} />
                            </div>
                          </div>
                        </div>

                        <div className="ui-kit-holding-card-grid">
                          <div className="ui-kit-holding-stat">
                            <span>Principal</span>
                            <strong>{INR(jewelLoan.principal)}</strong>
                          </div>
                          <div className="ui-kit-holding-stat ui-kit-holding-stat--center">
                            <span>Interest</span>
                            <strong>{INR(jewelLoan.interest)}</strong>
                          </div>
                          <div className="ui-kit-holding-stat ui-kit-holding-stat--right">
                            <span>Paid</span>
                            <strong>{INR(jewelLoan.paid)}</strong>
                          </div>
                        </div>

                        <div className="ui-kit-holding-card-grid">
                          <div className="ui-kit-holding-stat">
                            <span>Total Payable</span>
                            <strong>{INR(totalPayable)}</strong>
                          </div>
                          <div className="ui-kit-holding-stat ui-kit-holding-stat--center">
                            <span>Start Date</span>
                            <strong>{fmtDate(jewelLoan.startDate)}</strong>
                          </div>
                          <div className="ui-kit-holding-stat ui-kit-holding-stat--right">
                            <span>End Date</span>
                            <strong>{fmtDate(jewelLoan.endDate)}</strong>
                          </div>
                        </div>

                        <div className="ui-kit-holding-pnl ui-tone-red">
                          <div className="ui-kit-holding-pnl-row">
                            <div className="ui-kit-holding-pnl-label">Outstanding</div>
                            <div className="ui-kit-holding-pnl-value">{INR(jewelLoan.outstanding)}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </SectionBlock>
          </>
        )}

        {activeTab === 'cash' && (
          <>
            <SectionBlock
              title="Metrics"
              icon={<Banknote size={14} />}
              right={<SectionChip tone="muted">{cashLoans.length} loans</SectionChip>}
            >
              <div className="dash-grid">
                <KpiCard label="Principal" value={INR(cashLoans.reduce((sum, loan) => sum + loan.principal, 0))} tone="navy" icon={<Banknote size={14} />} />
                <KpiCard label="Paid" value={INR(cashLoans.reduce((sum, loan) => sum + loan.paid, 0))} tone="green" icon={<ArrowDownLeft size={14} />} />
                <KpiCard label="Outstanding" value={<span className="kpi-card-v--red">{INR(cashLoans.reduce((sum, loan) => sum + loan.outstanding, 0))}</span>} tone="red" icon={<ArrowUpRight size={14} />} />
                <KpiCard label="Loans" value={cashLoans.length} tone="muted" icon={<CreditCard size={14} />} />
              </div>
            </SectionBlock>

            <SectionBlock
              title="Cash Loans"
              icon={<Banknote size={14} />}
              right={<SectionChip tone="muted">{cashLoans.length} loans</SectionChip>}
            >
              {cashLoans.length === 0 ? (
                <p style={{ color: 'var(--muted)', padding: '0.5rem 0', fontSize: 14 }}>No loans yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 8 }}>
                  {cashLoans.map(loan => {
                    const cashLoan = loan as Extract<CombinedLoan, { kind: 'Cash' }>
                    return (
                      <div
                        key={cashLoan.id}
                        className={`ui-kit-holding-card${cashLoan.status === 'Ongoing' ? ' ui-kit-holding-card--accent-green' : ''} stock-entry-card`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openEditCash(cashLoan)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') openEditCash(cashLoan)
                        }}
                      >
                        <div className="ui-kit-holding-card-head">
                          <div>
                            <div className="ui-kit-holding-card-title">
                              <span>{cashLoan.name}</span>
                            </div>
                            <div className="ui-kit-holding-card-subtitle">Cash Loan</div>
                          </div>
                          <div className="ui-kit-holding-card-head-right">
                            <div className="ui-kit-holding-icon ui-kit-holding-icon--bg ui-tone-green">
                              <Banknote size={14} />
                            </div>
                          </div>
                        </div>

                        <div className="ui-kit-holding-card-grid">
                          <div className="ui-kit-holding-stat">
                            <span>Principal</span>
                            <strong>{INR(cashLoan.principal)}</strong>
                          </div>
                          <div className="ui-kit-holding-stat ui-kit-holding-stat--center">
                            <span>Date</span>
                            <strong>{fmtDate(cashLoan.startDate)}</strong>
                          </div>
                          <div className="ui-kit-holding-stat ui-kit-holding-stat--right">
                            <span>Paid</span>
                            <strong>{INR(cashLoan.paid)}</strong>
                          </div>
                        </div>

                        <div className="ui-kit-holding-pnl ui-tone-red">
                          <div className="ui-kit-holding-pnl-row">
                            <div className="ui-kit-holding-pnl-label">Outstanding</div>
                            <div className="ui-kit-holding-pnl-value">{INR(cashLoan.outstanding)}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </SectionBlock>
          </>
        )}
      </div>

      {(activeTab === 'emi' || activeTab === 'jewel' || activeTab === 'cash') && (
        <button
          onClick={activeTab === 'emi' ? openAddEmi : activeTab === 'jewel' ? openAddJewel : openAddCash}
          style={{ ...fabStyle, right: 20, background: 'var(--navy-dark)' }}
          title={activeTab === 'emi' ? 'Add EMI loan' : activeTab === 'jewel' ? 'Add jewel loan' : 'Add cash loan'}
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      {activeTab === 'history' && (
        <button
          onClick={openRepayment}
          title="Repayment"
          aria-label="Repayment"
          style={{ ...fabStyle, right: 20, background: 'var(--navy-dark)' }}
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      {emiModalOpen && (
        <ModalShell
          title={emiEditItem ? 'Edit EMI Loan' : 'Add EMI Loan'}
          onClose={closeEmiModal}
          footer={
            <ModalActions
              primaryLabel={emiSaving ? 'Saving…' : emiEditItem ? 'Save' : 'Add'}
              secondaryLabel="Cancel"
              onPrimary={saveEmi}
              onSecondary={closeEmiModal}
              leading={emiEditItem ? (
                <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={deleteEmiLoan} disabled={emiSaving}>
                  Delete
                </button>
              ) : null}
              disabled={emiSaving}
            />
          }
        >
          <div className="ui-stack">
            <FormField label="Name">
              <input className="form-inp" type="text" placeholder="Borrower / loan name" value={emiForm.name} onChange={e => setEmiField('name', e.target.value)} />
            </FormField>
            <FormField label="Bank">
              <input className="form-inp" type="text" placeholder="Bank name" value={emiForm.bank} onChange={e => setEmiField('bank', e.target.value)} />
            </FormField>
            <FormField label="Principal">
              <input className="form-inp" type="number" min="0" step="1" placeholder="0" value={emiForm.principal} onChange={e => setEmiField('principal', e.target.value)} />
            </FormField>
            <FormField label="Interest Rate">
              <input className="form-inp" type="number" min="0" step="0.1" placeholder="0" value={emiForm.rate} onChange={e => setEmiField('rate', e.target.value)} />
            </FormField>
            <FormField label="Start Date">
              <input className="form-inp" type="date" value={emiForm.start_date} onChange={e => setEmiField('start_date', e.target.value)} />
            </FormField>
            <FormField label="Tenure (months)">
              <input className="form-inp" type="number" min="1" step="1" placeholder="12" value={emiForm.tenure_months} onChange={e => setEmiField('tenure_months', e.target.value)} />
            </FormField>
            <FormField label="EMI Amount">
              <input className="form-inp" type="number" min="0" step="1" placeholder="0" value={emiForm.emi_amount} onChange={e => setEmiField('emi_amount', e.target.value)} />
            </FormField>
            <FormField label="Paid EMIs">
              <input className="form-inp" type="number" min="0" step="1" placeholder="0" value={emiForm.paid_emis} onChange={e => setEmiField('paid_emis', e.target.value)} />
            </FormField>
          </div>
        </ModalShell>
      )}

      {jewelModalOpen && (
        <ModalShell
          title={jewelEditItem ? 'Edit Jewel Loan' : 'Add Jewel Loan'}
          onClose={closeJewelModal}
          footer={
            <ModalActions
              primaryLabel={jewelSaving ? 'Saving…' : jewelEditItem ? 'Save' : 'Add'}
              secondaryLabel="Cancel"
              onPrimary={saveJewel}
              onSecondary={closeJewelModal}
              leading={jewelEditItem ? (
                <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={deleteJewelLoan} disabled={jewelSaving}>
                  Delete
                </button>
              ) : null}
              disabled={jewelSaving}
            />
          }
        >
          <div style={{ display: 'grid', gap: 8 }}>
            <FormField label="Name"><input className="form-inp" value={jewelForm.name} onChange={e => setJewelForm(f => ({ ...f, name: e.target.value }))} /></FormField>
            <FormField label="Bank"><input className="form-inp" value={jewelForm.bank} onChange={e => setJewelForm(f => ({ ...f, bank: e.target.value }))} /></FormField>
            <FormField label="Principal"><input className="form-inp" type="number" value={jewelForm.principal} onChange={e => setJewelForm(f => ({ ...f, principal: e.target.value }))} /></FormField>
            <FormField label="Rate"><input className="form-inp" type="number" value={jewelForm.rate} onChange={e => setJewelForm(f => ({ ...f, rate: e.target.value }))} /></FormField>
            <FormField label="Start Date"><input className="form-inp" type="date" value={jewelForm.start_date} onChange={e => setJewelForm(f => ({ ...f, start_date: e.target.value }))} /></FormField>
            <FormField label="End Date"><input className="form-inp" type="date" value={jewelForm.end_date} onChange={e => setJewelForm(f => ({ ...f, end_date: e.target.value }))} /></FormField>
            <FormField label="Paid Amount"><input className="form-inp" type="number" value={jewelForm.paid_amount} onChange={e => setJewelForm(f => ({ ...f, paid_amount: e.target.value }))} /></FormField>
          </div>
        </ModalShell>
      )}

      {cashModalOpen && (
        <ModalShell
          title={cashEditItem ? 'Edit Cash Loan' : 'Add Cash Loan'}
          onClose={closeCashModal}
          footer={
            <ModalActions
              primaryLabel={cashSaving ? 'Saving…' : cashEditItem ? 'Save' : 'Add'}
              secondaryLabel="Cancel"
              onPrimary={saveCash}
              onSecondary={closeCashModal}
              leading={cashEditItem ? (
                <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={deleteCashLoan} disabled={cashSaving}>
                  Delete
                </button>
              ) : null}
              disabled={cashSaving}
            />
          }
        >
          <div style={{ display: 'grid', gap: 8 }}>
            <FormField label="Person Name"><input className="form-inp" value={cashForm.person_name} onChange={e => setCashForm(f => ({ ...f, person_name: e.target.value }))} /></FormField>
            <FormField label="Amount Received"><input className="form-inp" type="number" value={cashForm.amount_received} onChange={e => setCashForm(f => ({ ...f, amount_received: e.target.value }))} /></FormField>
            <FormField label="Start Date"><input className="form-inp" type="date" value={cashForm.start_date} onChange={e => setCashForm(f => ({ ...f, start_date: e.target.value }))} /></FormField>
            <FormField label="Paid Amount"><input className="form-inp" type="number" value={cashForm.paid_amount} onChange={e => setCashForm(f => ({ ...f, paid_amount: e.target.value }))} /></FormField>
          </div>
        </ModalShell>
      )}

      {repayModalOpen && (activeTab === 'jewel' || activeTab === 'cash' || activeTab === 'history') && (
        <ModalShell
          title={repayEditItem ? 'Edit Repayment' : 'Add Repayment'}
          onClose={closeRepayment}
          footer={
            <ModalActions
              primaryLabel={repaySaving ? 'Saving…' : repayEditItem ? 'Save' : 'Add'}
              secondaryLabel="Cancel"
              onPrimary={saveRepayment}
              onSecondary={closeRepayment}
              leading={repayEditItem ? (
                <button type="button" className="ui-kit-btn ui-kit-btn--solid btn-red" onClick={deleteRepayment} disabled={repaySaving}>
                  Delete
                </button>
              ) : null}
              disabled={repaySaving}
            />
          }
        >
          <div style={{ display: 'grid', gap: 8 }}>
            {activeTab === 'history' && !repayEditItem && (
              <FormField label="Loan Type">
                <select
                  className="form-inp"
                  value={repayType}
                  onChange={e => {
                    const nextType = e.target.value === 'cash' ? 'cash' : 'jewel'
                    setRepayType(nextType)
                    const nextLoans = nextType === 'jewel' ? jewelRows : cashLoans
                    setRepayForm(f => ({ ...f, loan_id: nextLoans[0]?.id ?? '' }))
                  }}
                >
                  <option value="jewel">Jewel Loan</option>
                  <option value="cash">Cash Loan</option>
                </select>
              </FormField>
            )}
            <FormField label="Loan">
              <select
                className="form-inp"
                value={repayForm.loan_id}
                onChange={e => setRepayForm(f => ({ ...f, loan_id: e.target.value }))}
                disabled={Boolean(repayEditItem)}
              >
                <option value="">Select loan</option>
                {(repayType === 'jewel' ? jewelRows : cashLoans).map(loan => (
                  <option key={loan.id} value={loan.id}>{loan.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Date">
              <input className="form-inp" type="date" value={repayForm.date} onChange={e => setRepayForm(f => ({ ...f, date: e.target.value }))} />
            </FormField>
            <FormField label="Amount">
              <input className="form-inp" type="number" value={repayForm.amount} onChange={e => setRepayForm(f => ({ ...f, amount: e.target.value }))} />
            </FormField>
            <FormField label="Note">
              <input className="form-inp" type="text" value={repayForm.note} onChange={e => setRepayForm(f => ({ ...f, note: e.target.value }))} />
            </FormField>
          </div>
        </ModalShell>
      )}
    </div>
  )
}

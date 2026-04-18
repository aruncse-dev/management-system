import SavingsContent from './savingspage'

const ACCOUNTS = ['Amma IB', 'Ramya IB', 'Arun IB', 'Amma SBI', 'Cash'] as const

export default function Savings() {
  return (
    <SavingsContent
      sheetName="Savings"
      title="Savings"
      accounts={ACCOUNTS}
      addButtonTitle="Add savings entry"
    />
  )
}

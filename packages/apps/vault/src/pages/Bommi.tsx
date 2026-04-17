import SavingsPage from './SavingsPage';

const ACCOUNTS = ['Axis Bank', 'Indian Bank', 'Axis Credit Card'] as const;

export default function Bommi() {
  return (
    <SavingsPage
      sheetName="Bommi"
      title="Bommi"
      accounts={ACCOUNTS}
      addButtonTitle="Add Bommi entry"
    />
  );
}

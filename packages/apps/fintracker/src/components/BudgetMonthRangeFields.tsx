import { FormField } from '../ui'

export type MonthOption = { label: string; value: string }

export function BudgetMonthRangeFields({
  startMonth,
  endMonth,
  onStartChange,
  onEndChange,
  monthOptions,
  defaultMonthKey,
}: {
  startMonth: string | null
  endMonth: string | null
  onStartChange: (value: string | null) => void
  onEndChange: (value: string | null) => void
  monthOptions: MonthOption[]
  defaultMonthKey: string
}) {
  const optionStack = { display: 'flex', flexDirection: 'column' as const, gap: 8 }
  const optionLabel = { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--text)' }

  return (
    <>
      <FormField label="Start date">
        <div className="budget-range-options" style={optionStack}>
          <label style={optionLabel}>
            <input
              type="radio"
              name="budget-start"
              checked={startMonth === null}
              onChange={() => onStartChange(null)}
            />
            <span>From beginning</span>
          </label>
          <label style={optionLabel}>
            <input
              type="radio"
              name="budget-start"
              checked={startMonth !== null}
              onChange={() => onStartChange(startMonth ?? defaultMonthKey)}
            />
            <span>From month</span>
          </label>
          {startMonth !== null && (
            <select
              className="form-inp"
              value={startMonth}
              onChange={e => onStartChange(e.target.value)}
            >
              {monthOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
        </div>
      </FormField>
      <FormField label="End date">
        <div className="budget-range-options" style={optionStack}>
          <label style={optionLabel}>
            <input
              type="radio"
              name="budget-end"
              checked={endMonth === null}
              onChange={() => onEndChange(null)}
            />
            <span>Never</span>
          </label>
          <label style={optionLabel}>
            <input
              type="radio"
              name="budget-end"
              checked={endMonth !== null}
              onChange={() => onEndChange(endMonth ?? defaultMonthKey)}
            />
            <span>Until month</span>
          </label>
          {endMonth !== null && (
            <select
              className="form-inp"
              value={endMonth}
              onChange={e => onEndChange(e.target.value)}
            >
              {monthOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
        </div>
      </FormField>
    </>
  )
}

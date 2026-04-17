import { Check, Coins, Edit2, Landmark, Loader2, PiggyBank, ReceiptText, Wallet } from 'lucide-react'
import { UiCard } from '@fintracker-vault/ui'

export interface SettingField<T = Record<string, any>> {
  key: keyof T
  label: string
  type: 'text' | 'number'
}

type Props<T = Record<string, any>> = {
  field: SettingField<T>
  value: string
  editing: boolean
  saving: boolean
  editValue: string
  onStartEdit: () => void
  onChange: (value: string) => void
  onSave: (value: string) => Promise<void>
}

function fieldIcon(label: string) {
  const normalized = label.toLowerCase()
  if (normalized.includes('expense')) return <ReceiptText size={12} />
  if (normalized.includes('asset')) return <PiggyBank size={12} />
  if (normalized.includes('loan')) return <Wallet size={12} />
  if (normalized.includes('gold')) return <Coins size={12} />
  return <Landmark size={12} />
}

export function SettingsSectionCard<T = Record<string, any>>({
  field,
  value,
  editing,
  saving,
  editValue,
  onStartEdit,
  onChange,
  onSave,
}: Props<T>) {
  const displayValue = editing ? editValue : formatSettingValue(field, value)

  return (
    <UiCard
      title={
        <span className="settings-card-title-row">
          <span className="settings-card-type-icon">{fieldIcon(field.label)}</span>
          <span>{field.label}</span>
        </span>
      }
    >
      <div className="settings-field-row">
        <div className={`settings-value settings-value-box${editing ? ' settings-value-box--editing' : ''}`}>
          {editing ? (
            <input
              autoFocus
              type={field.type}
              value={editValue}
              onChange={e => onChange(e.target.value)}
              className="form-inp settings-input"
              aria-label={field.label}
            />
          ) : (
            <input
              type="text"
              value={displayValue || 'Not set'}
              className="form-inp settings-input settings-input--readonly"
              readOnly
              tabIndex={-1}
              aria-label={field.label}
            />
          )}
        </div>
        <button
          type="button"
          onClick={editing ? () => onSave(editValue) : onStartEdit}
          disabled={saving}
          className="ui-kit-btn ui-kit-btn--soft settings-icon-btn"
          aria-label={editing ? 'Save' : 'Edit'}
          title={editing ? 'Save' : 'Edit'}
        >
          {editing ? (saving ? <Loader2 size={13} className="spin-icon" /> : <Check size={13} />) : <Edit2 size={13} />}
        </button>
      </div>
    </UiCard>
  )
}

function formatSettingValue<T = Record<string, any>>(field: SettingField<T>, value: string) {
  if (field.type !== 'number') return value
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return value
  return String(Math.round(parsed))
}

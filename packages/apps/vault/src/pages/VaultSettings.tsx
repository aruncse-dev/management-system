import { useState, useEffect, useCallback } from 'react'
import { SlidersHorizontal, Database } from 'lucide-react'
import { api, type VaultSettings } from '../api'
import { LoadingState, SectionBlock, SectionTitle, Spacer, UiPill } from '../ui'
import { SettingsSectionCard, type SettingField } from '../ui'

interface SettingsSection {
  key: string
  title: string
  description: string
  icon: React.ReactNode
  fields: SettingField<VaultSettings>[]
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    key: 'storage',
    title: 'Sheet ID',
    description: '',
    icon: <Database size={16} />,
    fields: [
      { key: 'vaultSpreadsheetId', label: 'Vault Sheet ID', type: 'text' },
    ],
  },
]

export default function RecordsSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sheetStatus, setSheetStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')

  const validateLiveStatus = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError('')
    setSheetStatus('checking')
    try {
      if (forceRefresh) api.invalidateCache({ action: 'get', params: { module: 'vault' } })
      const settingsResult = await api.getVaultSettings()
      const loaded: Record<string, string> = {}
      SETTINGS_SECTIONS.forEach(section => {
        section.fields.forEach(field => {
          loaded[String(field.key)] = String(settingsResult[field.key as keyof VaultSettings] || '')
        })
      })
      setSettings(loaded)
      setSheetStatus('connected')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings')
      setSheetStatus('disconnected')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    validateLiveStatus()
  }, [validateLiveStatus])

  async function saveField(key: string, value: string) {
    setSaving(true)
    setError('')
    try {
      await api.saveVaultSettings({ [key]: value })
      setSettings(prev => ({ ...prev, [key]: value }))
      setEditingKey(null)
      await validateLiveStatus(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(key: string) {
    setEditingKey(key)
    setEditValue(settings[key] || '')
  }

  return (
    <div className="ui-kit-page-shell">
      <Spacer size={12} />
      <div style={{ display: 'grid', gap: 16 }}>
        <SectionTitle
          title="Settings"
          icon={<SlidersHorizontal size={16} />}
          right={<UiPill tone="muted">Live Config</UiPill>}
        />
        <div className="settings-status-grid">
          <StatusBox
            title="Google Sheets"
            icon={<Database size={14} />}
            tone={sheetStatus === 'checking' ? 'amber' : sheetStatus === 'connected' ? 'green' : 'red'}
            status={sheetStatus === 'checking' ? 'Checking…' : sheetStatus === 'connected' ? 'Connected' : 'Disconnected'}
          />
        </div>
        {error && <div className="settings-alert">⚠ {error}</div>}
        {loading && <LoadingState variant="section" />}

        {!loading && SETTINGS_SECTIONS.map(section => (
          <SectionBlock key={section.key} title={section.title} icon={section.icon}>
            <div style={{ display: 'grid', gap: 12 }}>
              {section.fields.map(field => (
                <SettingsSectionCard
                  key={field.key}
                  field={field}
                  value={settings[field.key] || ''}
                  editing={editingKey === field.key}
                  saving={saving}
                  editValue={editValue}
                  onStartEdit={() => startEdit(String(field.key))}
                  onChange={setEditValue}
                  onSave={value => saveField(String(field.key), value)}
                />
              ))}
            </div>
          </SectionBlock>
        ))}
      </div>
      <Spacer size={20} />
    </div>
  )
}

function StatusBox({
  title,
  icon,
  tone,
  status,
}: {
  title: string
  icon: React.ReactNode
  tone: 'green' | 'red' | 'amber'
  status: string
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 8,
        padding: 12,
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'var(--card)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>{icon}</span>
          <span>{title}</span>
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.04em',
            padding: '4px 8px',
            borderRadius: 6,
            background: tone === 'green' ? '#ECFDF5' : tone === 'amber' ? '#FFFBEB' : '#FEF2F2',
            color: tone === 'green' ? '#059669' : tone === 'amber' ? '#92400E' : '#991B1B',
          }}
        >
          {status}
        </span>
      </div>
    </div>
  )
}

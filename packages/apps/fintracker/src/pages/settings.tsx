import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Loader2, Link2, Unlink2, SlidersHorizontal, Database, RotateCcw } from 'lucide-react';
import { api } from '../api';
import { LoadingState, SectionBlock, SectionChip, SectionTitle, Spacer, UiCard } from '../ui';
import { SettingsSectionCard, type SettingField } from '../ui'

interface SettingsSection {
  key: string;
  title: string;
  description: string;
  icon: ReactNode;
  fields: SettingField[];
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    key: 'core',
    title: 'Core Settings',
    description: '',
    icon: <SlidersHorizontal size={16} />,
    fields: [{ key: 'goldRate', label: 'Gold Rate (₹/gram)', type: 'number' }],
  },
  {
    key: 'storage',
    title: 'Sheet IDs',
    description: '',
    icon: <Database size={16} />,
    fields: [
      { key: 'expensesSheetId', label: 'Expenses', type: 'text' },
      { key: 'assetsSheetId', label: 'Assets', type: 'text' },
      { key: 'loansSpreadsheetId', label: 'Loans', type: 'text' },
    ],
  },
];

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [upstoxStatus, setUpstoxStatus] = useState<{
    hasToken: boolean;
    hasAccessToken?: boolean;
    hasExtendedToken?: boolean;
    hasRefreshToken?: boolean;
    expired?: boolean;
  }>({ hasToken: false });
  const [sheetStatus, setSheetStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [upstoxStatusState, setUpstoxStatusState] = useState<'checking' | 'connected' | 'missing' | 'expired'>('checking');
  const [upstoxBusy, setUpstoxBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const validateLiveStatus = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError('');
    setSheetStatus('checking');
    setUpstoxStatusState('checking');
    try {
      if (forceRefresh) api.invalidateCache({ action: 'get', params: { module: 'settings' } });
      const [settingsResult, tokenResult] = await Promise.allSettled([api.getSettings(), api.getTokenStatus()]);
      const loaded: Record<string, string> = {};
      if (settingsResult.status === 'fulfilled') {
        SETTINGS_SECTIONS.forEach(section => {
          section.fields.forEach(field => {
            loaded[String(field.key)] = String(settingsResult.value[field.key as keyof typeof settingsResult.value] || '');
          });
        });
        setSettings(loaded);
        setSheetStatus('connected');
      } else {
        setSheetStatus('disconnected');
      }
      if (tokenResult.status === 'fulfilled') {
        setUpstoxStatus(tokenResult.value);
        const isConnected = Boolean(tokenResult.value.hasToken);
        setUpstoxStatusState(isConnected ? 'connected' : 'missing');
      } else {
        setUpstoxStatus({ hasToken: false });
        setUpstoxStatusState('missing');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
      setSheetStatus('disconnected');
      setUpstoxStatusState('missing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    validateLiveStatus();
  }, [validateLiveStatus]);

  async function saveField(key: string, value: string) {
    setSaving(true);
    setError('');
    try {
      await api.saveSettings({ [key]: value });
      setSettings(prev => ({ ...prev, [key]: value }));
      setEditingKey(null);
      await validateLiveStatus(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(key: string) {
    setEditingKey(key);
    setEditValue(settings[key] || '');
  }

  async function connectUpstox() {
    setUpstoxBusy(true);
    setError('');
    try {
      const response = await api.getUpstoxAuthUrl();
      window.location.assign(response.authUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open Upstox auth');
    } finally {
      setUpstoxBusy(false);
    }
  }

  async function clearUpstox() {
    setUpstoxBusy(true);
    setError('');
    try {
      await api.clearUpstoxAuth();
      setUpstoxStatus({ hasToken: false });
      setUpstoxStatusState('missing');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear Upstox token');
    } finally {
      setUpstoxBusy(false);
    }
  }

  async function resetBudgetDefaults() {
    if (!window.confirm('Reset all budget amounts to default values?')) return;
    setResetBusy(true);
    setError('');
    try {
      await api.resetBudget();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset budgets');
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="ui-kit-page-shell settings-page">
      <div className="pg settings-page">
      <Spacer size={12} />
      <div style={{ display: 'grid', gap: 16 }}>
        <SectionTitle
          title="Settings"
          icon={<SlidersHorizontal size={16} />}
          right={<SectionChip>Live Config</SectionChip>}
        />
        <div className="settings-status-grid">
          <StatusBox
            title="Google Sheets"
            icon={<Database size={14} />}
            tone={sheetStatus === 'checking' ? 'amber' : sheetStatus === 'connected' ? 'green' : 'red'}
            status={sheetStatus === 'checking' ? 'Checking…' : sheetStatus === 'connected' ? 'Connected' : 'Disconnected'}
          />
          <StatusBox
            title="Upstox"
            icon={<Link2 size={14} />}
            tone={upstoxStatusState === 'checking' ? 'amber' : upstoxStatusState === 'connected' ? 'green' : 'red'}
            status={upstoxStatusState === 'checking' ? 'Checking…' : upstoxStatusState === 'connected' ? 'Connected' : 'Missing'}
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
              {section.key === 'core' && (
                <div style={{ borderTop: '1px solid var(--muted-border)', paddingTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>USD → INR Rate</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    ₹{settings.usdToInr ? Number(settings.usdToInr).toFixed(2) : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Live rate (when connected to settings API)</div>
                </div>
              )}
            </div>
          </SectionBlock>
        ))}

        {!loading && (
          <>
            <SectionBlock
              title="Integrations"
              icon={<Link2 size={14} />}
            >
              <div className="settings-actions">
                <button className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline settings-action-btn" onClick={connectUpstox} disabled={upstoxBusy}>
                  <Link2 size={14} />
                  {upstoxStatus.hasToken ? 'Re-login' : 'Connect'} Upstox
                </button>
                <button className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline settings-action-btn" onClick={clearUpstox} disabled={upstoxBusy || !upstoxStatus.hasToken}>
                  <Unlink2 size={14} />
                  Logout Upstox
                </button>
              </div>
            </SectionBlock>

            <SectionBlock title="Actions" icon={<RotateCcw size={14} />}>
              <div className="settings-actions">
                <button className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline settings-action-btn" onClick={resetBudgetDefaults} disabled={resetBusy}>
                  {resetBusy ? <Loader2 size={14} className="spin-icon" /> : <RotateCcw size={14} />}
                  Reset Budgets
                </button>
              </div>
            </SectionBlock>
          </>
        )}
      </div>
      <Spacer size={20} />
      </div>
    </div>
  );
}

function StatusBox({
  title,
  icon,
  tone,
  status,
}: {
  title: string
  icon: ReactNode
  tone: 'green' | 'red' | 'amber'
  status: string
}) {
  return (
    <UiCard
      title={
        <span className="settings-status-title">
          <span className="settings-status-icon">{icon}</span>
          <span>{title}</span>
        </span>
      }
      right={<span className={`settings-chip ${tone === 'green' ? 'ok' : tone === 'amber' ? 'warn' : 'neutral'}`}>{status}</span>}
    >
      <div />
    </UiCard>
  )
}

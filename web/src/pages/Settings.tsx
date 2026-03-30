import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Loader2, Edit2, Check, RefreshCw, Link2, Unlink2, SlidersHorizontal, Database, Shield, RotateCcw } from 'lucide-react';
import { api, type GoldSettings } from '../api';

interface SettingField {
  key: keyof GoldSettings;
  label: string;
  type: 'text' | 'number';
}

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
    title: 'Core',
    description: 'Primary values that shape how the app behaves.',
    icon: <SlidersHorizontal size={16} />,
    fields: [
      { key: 'goldRate', label: 'Gold Rate (₹/gram)', type: 'number' },
    ],
  },
  {
    key: 'storage',
    title: 'Storage',
    description: 'Spreadsheet IDs used to read and write app data.',
    icon: <Database size={16} />,
    fields: [
      { key: 'expensesSheetId', label: 'Expenses Spreadsheet ID', type: 'text' },
      { key: 'assetsSheetId', label: 'Assets Spreadsheet ID', type: 'text' },
      { key: 'loansSpreadsheetId', label: 'Loans Spreadsheet ID', type: 'text' },
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
  }>({ hasToken: false });
  const [upstoxBusy, setUpstoxBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const loadSettings = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError('');
    try {
      if (forceRefresh) {
        api.invalidateCache();
      }
      const [data, tokenStatus] = await Promise.all([
        api.getSettings(),
        api.getTokenStatus(),
      ]);
      const loaded: Record<string, string> = {};
      SETTINGS_SECTIONS.forEach(section => {
        section.fields.forEach(field => {
          loaded[field.key] = String(data[field.key] || '');
        });
      });
      setSettings(loaded);
      setUpstoxStatus(tokenStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function saveField(key: string, value: string) {
    setSaving(true);
    setError('');
    try {
      await api.saveSettings({ [key]: value });
      setSettings(prev => ({ ...prev, [key]: value }));
      setEditingKey(null);
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
      const popup = window.open('about:blank', 'upstox-auth', 'noopener,noreferrer');
      const response = await api.getUpstoxAuthUrl();
      if (popup) {
        popup.location.href = response.authUrl;
        popup.focus();
      } else {
        window.location.assign(response.authUrl);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open Upstox auth');
    } finally {
      setUpstoxBusy(false);
    }
  }

  async function refreshUpstoxStatus() {
    setUpstoxBusy(true);
    setError('');
    try {
      setUpstoxStatus(await api.getTokenStatus());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh Upstox status');
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

  const statusText = upstoxStatus.hasToken ? 'Connected' : 'Not connected';
  const statusIcon = upstoxStatus.hasToken ? <Link2 size={12} /> : <Unlink2 size={12} />;
  const primaryUpstoxLabel = upstoxStatus.hasToken ? 'Re-login' : 'Connect';

  const statusChipClass = upstoxStatus.hasToken ? 'ok' : 'warn';

  return (
    <div className="settings-shell">
      <div className="pg">
        <div className="settings-page-grid">
          <div className="settings-card settings-hero">
            <div className="settings-card-hd">
              <div>
                <div className="section-title">
                  <Shield size={18} className="section-title-icon" />
                  <div>Settings</div>
                </div>
                <div className="settings-card-sub">
                  Compact app defaults, sheet links, and Upstox controls.
                </div>
              </div>
              <button
                onClick={() => loadSettings(true)}
                className="settings-action-btn"
                disabled={loading}
              >
                {loading ? <Loader2 size={16} className="spin-icon" /> : <RefreshCw size={16} />}
                Reload
              </button>
            </div>
          </div>

          {error && (
            <div className="settings-alert">
              ⚠ {error}
            </div>
          )}

          {loading ? (
            <div className="settings-loading">
              <Loader2 size={16} className="spin-icon" /> Loading…
            </div>
          ) : (
            <>
              {SETTINGS_SECTIONS.map(section => (
                <div key={section.key} className="settings-section">
                  <div className="settings-section-head">
                    <div className="settings-section-icon">
                      {section.icon}
                    </div>
                    <div>
                      <div className="settings-card-title">{section.title}</div>
                      <div className="settings-card-sub">{section.description}</div>
                    </div>
                  </div>
                  <div className="settings-items-grid">
                    {section.fields.map(field => (
                      <SettingCard
                        key={field.key}
                        field={field}
                        editingKey={editingKey}
                        editValue={editValue}
                        saving={saving}
                        settings={settings}
                        onStartEdit={startEdit}
                        onEditChange={setEditValue}
                        onSave={saveField}
                      />
                    ))}
                  </div>
                </div>
              ))}

              <div className="settings-card">
                <div className="settings-card-hd" style={{ marginBottom: 10 }}>
                  <div>
                    <div className="section-title" style={{ marginBottom: 4 }}>
                      <Link2 size={18} className="section-title-icon" />
                      <div>Upstox</div>
                    </div>
                    <div className="settings-card-sub">
                      Simple connect and logout controls for your GAS-linked token.
                    </div>
                  </div>
                  <span className={`settings-chip ${statusChipClass}`}>
                    {statusIcon}
                    {statusText}
                  </span>
                </div>

                <div className="settings-actions">
                  <button className="settings-action-btn" onClick={resetBudgetDefaults} disabled={resetBusy}>
                    {resetBusy ? <Loader2 size={14} className="spin-icon" /> : <RotateCcw size={14} />}
                    Reset Budgets
                  </button>
                  <button className="settings-action-btn" onClick={connectUpstox} disabled={upstoxBusy}>
                    <Link2 size={14} />
                    {primaryUpstoxLabel}
                  </button>
                  <button className="settings-action-btn" onClick={clearUpstox} disabled={upstoxBusy || !upstoxStatus.hasToken}>
                    <Unlink2 size={14} />
                    Logout
                  </button>
                  <button className="settings-action-btn" onClick={refreshUpstoxStatus} disabled={upstoxBusy}>
                    {upstoxBusy ? <Loader2 size={14} className="spin-icon" /> : <RefreshCw size={14} />}
                    Refresh
                  </button>
                </div>
              </div>

            </>
          )}
          </div>
        </div>
      </div>
  );
}

function SettingCard({
  field,
  editingKey,
  editValue,
  saving,
  settings,
  onStartEdit,
  onEditChange,
  onSave,
}: {
  field: SettingField;
  editingKey: string | null;
  editValue: string;
  saving: boolean;
  settings: Record<string, string>;
  onStartEdit: (key: string) => void;
  onEditChange: (value: string) => void;
  onSave: (key: string, value: string) => Promise<void>;
}) {
  const isEditing = editingKey === field.key;
  const displayValue = isEditing ? editValue : formatSettingValue(field, settings[field.key] || '');
  return (
    <div className="settings-item-card">
      <div className="settings-item-top">
        <div className="settings-row-label">{field.label}</div>
      </div>
      <div className="settings-item-value">
        <input
          autoFocus={isEditing}
          type={field.type}
          value={displayValue}
          onChange={e => onEditChange(e.target.value)}
          readOnly={!isEditing}
          className="form-inp settings-item-input"
          style={{ cursor: isEditing ? 'text' : 'pointer' }}
          onClick={() => !isEditing && onStartEdit(field.key)}
        />
        <button
          onClick={() => isEditing ? onSave(field.key, editValue) : onStartEdit(field.key)}
          disabled={saving && !isEditing}
          className="settings-action-btn settings-item-action"
          aria-label={isEditing ? 'Save setting' : 'Edit setting'}
          title={isEditing ? 'Save' : 'Edit'}
        >
          {saving && isEditing ? <Loader2 size={14} className="spin-icon" /> : isEditing ? <Check size={14} /> : <Edit2 size={14} />}
        </button>
      </div>
    </div>
  );
}

function formatSettingValue(field: SettingField, value: string) {
  if (field.type !== 'number') return value;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return String(Math.round(parsed));
}

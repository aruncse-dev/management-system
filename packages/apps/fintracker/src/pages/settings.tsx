import { useState, useEffect, useCallback, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/router';
import { Loader2, Link2, Unlink2, SlidersHorizontal, User, Wallet, CreditCard, Plus, Users, Banknote, Landmark, PiggyBank, CalendarRange } from 'lucide-react';
import { api, type AccountRow, type AccountUsedFor, type CreditSourceCategory, type CreditSourceRow, type ProfileData } from '../api';
import { THEME_COLORS } from '../config';
import { LoadingState, SectionBlock, SectionChip, FormField, Spacer, SettingsSectionCard, TransactionCard, UiCard, type SettingField } from '../ui';
import { useFintrackerModes } from '../context/FintrackerModesContext';
import type { FintrackerPrefs } from '../expenseCycle';
import { DEFAULT_FINTRACKER_PREFS, cycleDateRange, cycleSubtitle } from '../expenseCycle';

type SettingsNavTab = 'general' | 'accounts' | 'credits';

interface SettingsSection {
  key: string;
  title: string;
  description: string;
  icon: ReactNode;
  fields: SettingField[];
}

/** Account row icon from name (case-insensitive); credits use fixed icons. */
function accountNameIcon(name: string) {
  const s = name.toLowerCase()
  if (s.includes('cash')) return <Banknote size={14} aria-hidden />
  if (s.includes('bank')) return <Landmark size={14} aria-hidden />
  if (s.includes('wallet')) return <Wallet size={14} aria-hidden />
  return <PiggyBank size={14} aria-hidden />
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    key: 'core',
    title: 'Core Settings',
    description: '',
    icon: <SlidersHorizontal size={14} />,
    fields: [{ key: 'goldRate', label: 'Gold Rate (₹/gram)', type: 'number' }],
  },
];

export default function Settings() {
  const router = useRouter();
  const rawTab = typeof router.query.tab === 'string' ? router.query.tab : '';
  const settingsTab: SettingsNavTab = rawTab === 'accounts' || rawTab === 'credits' ? rawTab : 'general';
  const setSettingsTab = (t: SettingsNavTab) => {
    void router.replace({ pathname: '/settings', query: t === 'general' ? {} : { tab: t } }, undefined, { shallow: true });
  };

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [acctDelConfirm, setAcctDelConfirm] = useState(false);
  const [crDelConfirm, setCrDelConfirm] = useState(false);

  const { accounts: dbAccounts, creditSources: dbCredits, refresh: refreshModes, loading: modesLoading } = useFintrackerModes();

  const [acctId, setAcctId] = useState<string | undefined>();
  const [acctName, setAcctName] = useState('');
  const [acctDesc, setAcctDesc] = useState('');
  const [acctUsed, setAcctUsed] = useState<AccountUsedFor>('both');
  const [acctBusy, setAcctBusy] = useState(false);

  const [crId, setCrId] = useState<string | undefined>();
  const [crName, setCrName] = useState('');
  const [crDesc, setCrDesc] = useState('');
  const [crCat, setCrCat] = useState<CreditSourceCategory>('credit_card');
  const [crBusy, setCrBusy] = useState(false);

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
  const [upstoxStatusState, setUpstoxStatusState] = useState<'checking' | 'connected' | 'missing' | 'expired'>('checking');
  const [upstoxBusy, setUpstoxBusy] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [fintrackerDraft, setFintrackerDraft] = useState<FintrackerPrefs>(() => ({
    expenseCycle: { ...DEFAULT_FINTRACKER_PREFS.expenseCycle },
  }));
  const [fintrackerJson, setFintrackerJson] = useState('');
  const [fintrackerSaving, setFintrackerSaving] = useState(false);

  const validateLiveStatus = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError('');
    setUpstoxStatusState('checking');
    try {
      if (forceRefresh) api.invalidateCache({ action: 'get', params: { module: 'settings' } });
      const [settingsResult, tokenResult, profileResult] = await Promise.allSettled([
        api.getSettings(),
        api.getTokenStatus(),
        api.getProfile(),
      ]);
      const loaded: Record<string, string> = {};
      if (settingsResult.status === 'fulfilled') {
        SETTINGS_SECTIONS.forEach(section => {
          section.fields.forEach(field => {
            loaded[String(field.key)] = String(settingsResult.value[field.key as keyof typeof settingsResult.value] || '');
          });
        });
        loaded.usdToInr = settingsResult.value.usdToInr !== undefined ? String(settingsResult.value.usdToInr) : '';
        const ft = settingsResult.value.fintracker;
        if (ft && typeof ft === 'object' && ft.expenseCycle) {
          setFintrackerDraft({
            expenseCycle: {
              mode: ft.expenseCycle.mode === 'custom' ? 'custom' : 'regular',
              anchorDay: Math.min(31, Math.max(2, Math.floor(Number(ft.expenseCycle.anchorDay)) || 19)),
            },
          });
        } else {
          setFintrackerDraft({ expenseCycle: { ...DEFAULT_FINTRACKER_PREFS.expenseCycle } });
        }
        setFintrackerJson(
          typeof settingsResult.value.fintrackerJson === 'string'
            ? settingsResult.value.fintrackerJson
            : JSON.stringify(ft ?? DEFAULT_FINTRACKER_PREFS),
        );
      }
      setSettings(loaded);
      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value);
      } else {
        setProfile(null);
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
      setUpstoxStatusState('missing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    validateLiveStatus();
  }, [validateLiveStatus]);

  useEffect(() => {
    setAccountModalOpen(false);
    setCreditModalOpen(false);
    setAcctDelConfirm(false);
    setCrDelConfirm(false);
  }, [settingsTab]);

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

  async function saveFintrackerPrefs() {
    setFintrackerSaving(true);
    setError('');
    try {
      await api.saveSettings({ fintracker: fintrackerDraft });
      window.dispatchEvent(new Event('fintracker:prefs'));
      await validateLiveStatus(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setFintrackerSaving(false);
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

  function resetAcctForm() {
    setAcctId(undefined);
    setAcctName('');
    setAcctDesc('');
    setAcctUsed('both');
  }

  function startEditAccount(a: AccountRow) {
    setAcctDelConfirm(false);
    setAcctId(a.id);
    setAcctName(a.name);
    setAcctDesc(a.description ?? '');
    setAcctUsed((a.usedFor as AccountUsedFor) || 'both');
  }

  async function submitAccount(e: FormEvent) {
    e.preventDefault();
    setAcctBusy(true);
    setError('');
    try {
      await api.saveAccount({
        id: acctId,
        name: acctName.trim(),
        description: acctDesc.trim() || null,
        usedFor: acctUsed,
      });
      resetAcctForm();
      setAccountModalOpen(false);
      setAcctDelConfirm(false);
      await refreshModes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setAcctBusy(false);
    }
  }

  async function deleteAccountFromModal() {
    if (!acctId) return;
    if (!acctDelConfirm) {
      setAcctDelConfirm(true);
      return;
    }
    setError('');
    try {
      await api.deleteAccount(acctId);
      resetAcctForm();
      setAccountModalOpen(false);
      setAcctDelConfirm(false);
      await refreshModes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function closeAccountModal() {
    setAccountModalOpen(false);
    resetAcctForm();
    setAcctDelConfirm(false);
  }

  function resetCrForm() {
    setCrId(undefined);
    setCrName('');
    setCrDesc('');
    setCrCat('credit_card');
  }

  function startEditCredit(c: CreditSourceRow) {
    setCrDelConfirm(false);
    setCrId(c.id);
    setCrName(c.name);
    setCrDesc(c.description ?? '');
    setCrCat((c.category as CreditSourceCategory) || 'credit_card');
  }

  async function submitCredit(e: FormEvent) {
    e.preventDefault();
    setCrBusy(true);
    setError('');
    try {
      await api.saveCreditSource({
        id: crId,
        name: crName.trim(),
        description: crDesc.trim() || null,
        category: crCat,
      });
      resetCrForm();
      setCreditModalOpen(false);
      setCrDelConfirm(false);
      await refreshModes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setCrBusy(false);
    }
  }

  async function deleteCreditFromModal() {
    if (!crId) return;
    if (!crDelConfirm) {
      setCrDelConfirm(true);
      return;
    }
    setError('');
    try {
      await api.deleteCreditSource(crId);
      resetCrForm();
      setCreditModalOpen(false);
      setCrDelConfirm(false);
      await refreshModes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function closeCreditModal() {
    setCreditModalOpen(false);
    resetCrForm();
    setCrDelConfirm(false);
  }

  return (
    <div className="ui-kit-page-shell savings-page">
      <nav className="bottom-nav" aria-label="Settings sections">
        <button
          type="button"
          className={`bottom-nav-item${settingsTab === 'general' ? ' active' : ''}`}
          onClick={() => setSettingsTab('general')}
        >
          <span className="bottom-nav-icon"><SlidersHorizontal size={19} /></span>
          <span>General</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item${settingsTab === 'accounts' ? ' active' : ''}`}
          onClick={() => setSettingsTab('accounts')}
        >
          <span className="bottom-nav-icon"><Wallet size={19} /></span>
          <span>Accounts</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item${settingsTab === 'credits' ? ' active' : ''}`}
          onClick={() => setSettingsTab('credits')}
        >
          <span className="bottom-nav-icon"><CreditCard size={19} /></span>
          <span>Credits</span>
        </button>
      </nav>

      <div className="pg savings-page">
        {settingsTab === 'general' && (
          <>
            {profile ? (
              <div className="txn-cards">
                <TransactionCard
                  asStatic
                  tone="navy"
                  icon={<User size={14} aria-hidden />}
                  title={(profile.displayName && profile.displayName.trim()) || profile.email}
                  amount={profile.displayName?.trim() ? profile.email : '\u00a0'}
                  amountLabel="Email"
                  type={
                    profile.activeOrgId
                      ? profile.orgs.find((o) => o.id === profile.activeOrgId)?.name ?? 'Unknown org'
                      : '—'
                  }
                  typeLabel="Organization"
                  date={profile.orgs.length ? `${profile.orgs.length} linked` : '—'}
                  dateLabel="Orgs"
                />
              </div>
            ) : null}

            {loading && (
              <>
                {profile ? <Spacer size={6} /> : null}
                <LoadingState variant="section" />
              </>
            )}

            {!loading && (
              <SectionBlock title="Expense period" icon={<CalendarRange size={14} />}>
                <div className="ui-stack" style={{ gap: 12 }}>
                  <FormField label="Cycle">
                    <select
                      className="form-inp"
                      value={fintrackerDraft.expenseCycle.mode}
                      onChange={(e) =>
                        setFintrackerDraft((prev) => ({
                          ...prev,
                          expenseCycle: {
                            ...prev.expenseCycle,
                            mode: e.target.value === 'custom' ? 'custom' : 'regular',
                          },
                        }))
                      }
                    >
                      <option value="regular">Regular (calendar month)</option>
                      <option value="custom">Custom (prev month anchor → this month anchor − 1)</option>
                    </select>
                  </FormField>
                  {fintrackerDraft.expenseCycle.mode === 'custom' ? (
                    <FormField label="Anchor day (cycle starts this day of previous month)">
                      <input
                        className="form-inp"
                        type="number"
                        min={2}
                        max={31}
                        value={fintrackerDraft.expenseCycle.anchorDay}
                        onChange={(e) =>
                          setFintrackerDraft((prev) => ({
                            ...prev,
                            expenseCycle: {
                              ...prev.expenseCycle,
                              anchorDay: Math.min(
                                31,
                                Math.max(2, parseInt(e.target.value || '19', 10) || 19),
                              ),
                            },
                          }))
                        }
                      />
                    </FormField>
                  ) : null}
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Example (May 2026):{' '}
                    <strong style={{ color: 'var(--text)' }}>{cycleSubtitle('May', '2026', fintrackerDraft)}</strong>
                    {' · '}
                    {(() => {
                      try {
                        const r = cycleDateRange('May', '2026', fintrackerDraft)
                        return `${r.start} → ${r.end}`
                      } catch {
                        return ''
                      }
                    })()}
                  </div>
                  <details style={{ fontSize: 12, color: 'var(--muted)' }}>
                    <summary style={{ cursor: 'pointer', marginBottom: 6 }}>
                      Stored JSON (<code>settings.fintracker</code>)
                    </summary>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 11, margin: 0 }}>{fintrackerJson}</pre>
                  </details>
                  <button
                    type="button"
                    className="ui-kit-btn ui-kit-btn--solid ui-kit-btn-inline settings-action-btn"
                    onClick={() => void saveFintrackerPrefs()}
                    disabled={fintrackerSaving}
                  >
                    {fintrackerSaving ? <Loader2 size={14} className="spin-icon" /> : null}
                    Save expense period
                  </button>
                </div>
              </SectionBlock>
            )}

            <Spacer size={6} />

            <SectionBlock
              title="Upstox"
              icon={<Link2 size={14} />}
              right={
                <SectionChip>
                  {upstoxStatusState === 'checking' ? '…' : upstoxStatusState === 'connected' ? 'Live' : 'Off'}
                </SectionChip>
              }
            >
              <div className="settings-status-grid">
                <StatusBox
                  title="Upstox"
                  icon={<Link2 size={14} />}
                  tone={upstoxStatusState === 'checking' ? 'amber' : upstoxStatusState === 'connected' ? 'green' : 'red'}
                  status={upstoxStatusState === 'checking' ? 'Checking…' : upstoxStatusState === 'connected' ? 'Connected' : 'Missing'}
                />
              </div>
            </SectionBlock>

            <Spacer size={6} />

            {!loading && SETTINGS_SECTIONS.map((section, idx) => (
              <div key={section.key}>
                {idx === 0 ? <Spacer size={6} /> : null}
                <SectionBlock title={section.title} icon={section.icon}>
                  <div className="ui-stack">
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
              </div>
            ))}

            {!loading && (
              <>
                <Spacer size={6} />
                <SectionBlock title="Integrations" icon={<Link2 size={14} />}>
                  <div className="ui-stack">
                    <div className="settings-actions" style={{ flexWrap: 'wrap' }}>
                      <button className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline settings-action-btn" onClick={connectUpstox} disabled={upstoxBusy}>
                        <Link2 size={14} />
                        {upstoxStatus.hasToken ? 'Re-login' : 'Connect'} Upstox
                      </button>
                      <button className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline settings-action-btn" onClick={clearUpstox} disabled={upstoxBusy || !upstoxStatus.hasToken}>
                        <Unlink2 size={14} />
                        Logout Upstox
                      </button>
                    </div>
                  </div>
                </SectionBlock>
              </>
            )}
          </>
        )}

        {settingsTab === 'accounts' && (
          <SectionBlock title="Accounts" icon={<Wallet size={14} />} right={<SectionChip>{dbAccounts.length}</SectionChip>}>
            {modesLoading ? (
              <LoadingState variant="section" />
            ) : dbAccounts.length === 0 ? (
              <p style={{ color: 'var(--muted)', padding: '0.25rem 0', fontSize: 14 }}>No accounts yet. Tap + to add one.</p>
            ) : (
              <div className="txn-cards">
                {dbAccounts.map(a => (
                  <TransactionCard
                    key={a.id}
                    compact
                    title={a.name}
                    tone="navy"
                    icon={accountNameIcon(a.name)}
                    onClick={() => {
                      startEditAccount(a);
                      setAccountModalOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </SectionBlock>
        )}

        {settingsTab === 'credits' && (
          <>
            <SectionBlock title="Credit cards" icon={<CreditCard size={14} />} right={<SectionChip>{dbCredits.filter(c => c.category === 'credit_card').length}</SectionChip>}>
              {modesLoading ? (
                <LoadingState variant="section" />
              ) : dbCredits.filter(c => c.category === 'credit_card').length === 0 ? (
                <p style={{ color: 'var(--muted)', padding: '0.25rem 0', fontSize: 14 }}>No cards yet. Tap + to add.</p>
              ) : (
                <div className="txn-cards">
                  {dbCredits.filter(c => c.category === 'credit_card').map(c => (
                    <TransactionCard
                      key={c.id}
                      compact
                      title={c.name}
                      tone="red"
                      icon={<CreditCard size={14} />}
                      onClick={() => {
                        startEditCredit(c);
                        setCreditModalOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </SectionBlock>

            <Spacer size={6} />

            <SectionBlock title="Other credits" icon={<Users size={14} />} right={<SectionChip>{dbCredits.filter(c => c.category === 'informal').length}</SectionChip>}>
              {modesLoading ? (
                <LoadingState variant="section" />
              ) : dbCredits.filter(c => c.category === 'informal').length === 0 ? (
                <p style={{ color: 'var(--muted)', padding: '0.25rem 0', fontSize: 14 }}>No informal credits yet. Tap + to add.</p>
              ) : (
                <div className="txn-cards">
                  {dbCredits.filter(c => c.category === 'informal').map(c => (
                    <TransactionCard
                      key={c.id}
                      compact
                      title={c.name}
                      tone="amber"
                      icon={<Users size={14} />}
                      onClick={() => {
                        startEditCredit(c);
                        setCreditModalOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </SectionBlock>
          </>
        )}

        {error ? (
          <p style={{ color: THEME_COLORS[5], fontSize: 13, padding: '12px 10px', marginTop: 12 }}>
            {'⚠ '}{error}
          </p>
        ) : null}
      </div>

      {settingsTab === 'accounts' && !modesLoading && (
        <button
          type="button"
          onClick={() => {
            resetAcctForm();
            setAcctDelConfirm(false);
            setAccountModalOpen(true);
          }}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 20,
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--navy-dark)',
            color: '#fff',
            border: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,.2)',
            cursor: 'pointer',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Add account"
          aria-label="Add account"
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      {settingsTab === 'credits' && !modesLoading && (
        <button
          type="button"
          onClick={() => {
            resetCrForm();
            setCrDelConfirm(false);
            setCreditModalOpen(true);
          }}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 20,
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--navy-dark)',
            color: '#fff',
            border: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,.2)',
            cursor: 'pointer',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Add credit source"
          aria-label="Add credit source"
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      {accountModalOpen && (
        <div className="modal-bg open" onClick={closeAccountModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd modal-hd--blue">
              <span className="modal-title">{acctId ? 'Edit account' : 'Add account'}</span>
              <button type="button" className="modal-close" onClick={closeAccountModal}>
                ×
              </button>
            </div>
            <form onSubmit={submitAccount}>
              <div className="modal-body">
                <div className="ui-stack">
                  <FormField label="Name">
                    <input className="form-inp" value={acctName} onChange={e => setAcctName(e.target.value)} required />
                  </FormField>
                  <FormField label="Description">
                    <input className="form-inp" value={acctDesc} onChange={e => setAcctDesc(e.target.value)} />
                  </FormField>
                  <FormField label="Used for">
                    <select className="form-sel" value={acctUsed} onChange={e => setAcctUsed(e.target.value as AccountUsedFor)}>
                      <option value="savings">Savings</option>
                      <option value="monthly">Monthly expenses</option>
                      <option value="both">Both</option>
                    </select>
                  </FormField>
                </div>
              </div>
              <div className="modal-foot">
                {acctId ? (
                  <button type="button" className="btn btn-sm btn-red" onClick={() => void deleteAccountFromModal()}>
                    {acctDelConfirm ? 'Confirm delete?' : 'Delete'}
                  </button>
                ) : (
                  <span />
                )}
                <div className="modal-foot-l" />
                <button type="button" className="btn btn-sm btn-cancel" onClick={closeAccountModal} disabled={acctBusy}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm btn-green" disabled={acctBusy}>
                  {acctBusy ? 'Saving…' : acctId ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {creditModalOpen && (
        <div className="modal-bg open" onClick={closeCreditModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-hd modal-hd--blue">
              <span className="modal-title">{crId ? 'Edit credit source' : 'Add credit source'}</span>
              <button type="button" className="modal-close" onClick={closeCreditModal}>
                ×
              </button>
            </div>
            <form onSubmit={submitCredit}>
              <div className="modal-body">
                <div className="ui-stack">
                  <FormField label="Name">
                    <input className="form-inp" value={crName} onChange={e => setCrName(e.target.value)} required />
                  </FormField>
                  <FormField label="Description">
                    <input className="form-inp" value={crDesc} onChange={e => setCrDesc(e.target.value)} />
                  </FormField>
                  <FormField label="Category">
                    <select className="form-sel" value={crCat} onChange={e => setCrCat(e.target.value as CreditSourceCategory)}>
                      <option value="credit_card">Credit card</option>
                      <option value="informal">Other / informal</option>
                    </select>
                  </FormField>
                </div>
              </div>
              <div className="modal-foot">
                {crId ? (
                  <button type="button" className="btn btn-sm btn-red" onClick={() => void deleteCreditFromModal()}>
                    {crDelConfirm ? 'Confirm delete?' : 'Delete'}
                  </button>
                ) : (
                  <span />
                )}
                <div className="modal-foot-l" />
                <button type="button" className="btn btn-sm btn-cancel" onClick={closeCreditModal} disabled={crBusy}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm btn-green" disabled={crBusy}>
                  {crBusy ? 'Saving…' : crId ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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

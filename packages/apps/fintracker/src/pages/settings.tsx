import { useState, useEffect, useCallback, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/router';
import { Loader2, Link2, Unlink2, SlidersHorizontal, RotateCcw, User, Building2, Wallet, CreditCard, Plus, Users } from 'lucide-react';
import { api, type AccountRow, type AccountUsedFor, type CreditSourceCategory, type CreditSourceRow, type ProfileData } from '../api';
import { THEME_COLORS } from '../config';
import { LoadingState, SectionBlock, SectionChip, FormField, Spacer, SettingsSectionCard, TransactionCard, UiCard, type SettingField } from '../ui';
import { useFintrackerModes } from '../context/FintrackerModesContext';

type SettingsNavTab = 'general' | 'accounts' | 'credits';

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
  const [resetBusy, setResetBusy] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);

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

  function accountScopeLabel(u: string) {
    if (u === 'both') return 'Savings + Monthly';
    if (u === 'savings') return 'Savings';
    if (u === 'monthly') return 'Monthly';
    return u;
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

            {!loading && profile && (
              <SectionBlock title="Profile" icon={<User size={14} />}>
                <div className="ui-stack">
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Name</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                      {(profile.displayName && profile.displayName.trim()) || profile.email}
                    </div>
                    {profile.displayName?.trim() ? (
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{profile.email}</div>
                    ) : null}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={14} aria-hidden />
                      Organization
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                      {profile.activeOrgId
                        ? profile.orgs.find(o => o.id === profile.activeOrgId)?.name ?? 'Unknown org'
                        : '—'}
                    </div>
                  </div>
                </div>
              </SectionBlock>
            )}
            {loading && <LoadingState variant="section" />}

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

                <Spacer size={6} />
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
                    title={
                      <span>
                        {a.name}
                        {a.description ? (
                          <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginTop: 4 }}>{a.description}</span>
                        ) : null}
                      </span>
                    }
                    amount="—"
                    type={accountScopeLabel(a.usedFor)}
                    date="Tap to edit"
                    tone="navy"
                    icon={<Wallet size={14} />}
                    onClick={() => {
                      startEditAccount(a);
                      setAccountModalOpen(true);
                    }}
                    amountLabel=" "
                    typeLabel="Scope"
                    dateLabel=" "
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
                      title={
                        <span>
                          {c.name}
                          {c.description ? (
                            <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginTop: 4 }}>{c.description}</span>
                          ) : null}
                        </span>
                      }
                      amount="—"
                      type="Credit card"
                      date="Tap to edit"
                      tone="red"
                      icon={<CreditCard size={14} />}
                      onClick={() => {
                        startEditCredit(c);
                        setCreditModalOpen(true);
                      }}
                      amountLabel="Balance"
                      typeLabel="Category"
                      dateLabel=" "
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
                      title={
                        <span>
                          {c.name}
                          {c.description ? (
                            <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginTop: 4 }}>{c.description}</span>
                          ) : null}
                        </span>
                      }
                      amount="—"
                      type="Informal"
                      date="Tap to edit"
                      tone="amber"
                      icon={<Users size={14} />}
                      onClick={() => {
                        startEditCredit(c);
                        setCreditModalOpen(true);
                      }}
                      amountLabel="Balance"
                      typeLabel="Category"
                      dateLabel=" "
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
                      <option value="savings">Savings only</option>
                      <option value="monthly">Monthly expenses only</option>
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

import { useState, useEffect, useCallback, useLayoutEffect, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import {
  Loader2,
  Link2,
  Unlink2,
  SlidersHorizontal,
  User,
  Wallet,
  CreditCard,
  Plus,
  Users,
  Banknote,
  Landmark,
  PiggyBank,
  CalendarRange,
  Coins,
  Plug,
  DollarSign,
  Gem,
  MapPin,
  ArrowRightLeft,
} from 'lucide-react';
import {
  api,
  type AccountRow,
  type AccountUsedFor,
  type CreditSourceCategory,
  type CreditSourceRow,
  type GoldResource,
  type ProfileData,
} from '../api';
import { THEME_COLORS } from '../config';
import { LoadingState, SectionBlock, SectionChip, FormField, Spacer, SettingsSectionCard, TransactionCard, type SettingField } from '../ui';
import { useFintrackerModes } from '../context/FintrackerModesContext';
import { MENU_CACHE_UPDATED_EVENT, readMenuCache } from '../lib/profileMenuCache';
import { mergeWriteSettingsPageCache, readSettingsPageCache, type SettingsPageCachePayload } from '../lib/settingsPageCache';
import type { FintrackerPrefs } from '../expenseCycle';
import { DEFAULT_FINTRACKER_PREFS, cycleDateRange, cycleSubtitle } from '../expenseCycle';
import { formatCurrency } from '../../../../shared/utils/src/formatters';

type SettingsNavTab = 'general' | 'accounts' | 'gold';

/** New gold resource rows use server-generated UUIDs. */

function readMenuHasPath(path: string): boolean {
  const target = path.replace(/\/+$/, '') || path;
  const menu = readMenuCache()?.menu ?? [];
  return menu.some(m => {
    const p = (m.path ?? '').trim().replace(/\/+$/, '');
    return p === target;
  });
}

const GOLD_RATE_FIELD: SettingField = { key: 'goldRate', label: 'Gold rate (INR/gram)', type: 'number' };

type ValidateLiveArg = boolean | { forceInvalidate?: boolean; background?: boolean };

/** Same shell as `TransactionCard` lists on Accounts / Credits (holding row + txn border). */
const GENERAL_SETTINGS_PANEL =
  'ui-kit-holding-card ui-kit-holding-card--accent-navy txn-entry-card' as const

/** Account row icon from name (case-insensitive); credits use fixed icons. */
function accountNameIcon(name: string) {
  const s = name.toLowerCase()
  if (s.includes('cash')) return <Banknote size={14} aria-hidden />
  if (s.includes('bank')) return <Landmark size={14} aria-hidden />
  if (s.includes('wallet')) return <Wallet size={14} aria-hidden />
  return <PiggyBank size={14} aria-hidden />
}

export default function Settings() {
  const router = useRouter();
  const rawTab = typeof router.query.tab === 'string' ? router.query.tab : '';
  const settingsTab: SettingsNavTab =
    rawTab === 'accounts' || rawTab === 'credits'
      ? 'accounts'
      : rawTab === 'gold'
        ? 'gold'
        : 'general';
  const setSettingsTab = (t: SettingsNavTab) => {
    void router.replace({ pathname: '/settings', query: t === 'general' ? {} : { tab: t } }, undefined, { shallow: true });
  };

  useEffect(() => {
    if (router.isReady && rawTab === 'credits') {
      void router.replace({ pathname: '/settings', query: { tab: 'accounts' } }, undefined, { shallow: true });
    }
  }, [router, rawTab, router.isReady]);

  const [moneyModalOpen, setMoneyModalOpen] = useState(false);
  const [moneyModalKind, setMoneyModalKind] = useState<'account' | 'credit'>('account');
  const [acctDelConfirm, setAcctDelConfirm] = useState(false);
  const [crDelConfirm, setCrDelConfirm] = useState(false);

  const {
    accounts: dbAccounts,
    creditSources: dbCredits,
    refresh: refreshModes,
    loading: modesLoading,
    monthlyAccountNames,
    savingsAccountNames,
  } = useFintrackerModes();

  const [hasInvestmentsMenu, setHasInvestmentsMenu] = useState(() => readMenuHasPath('/investments'));
  const [hasGoldMenu, setHasGoldMenu] = useState(() => readMenuHasPath('/gold'));
  const [hasSubscriptionsMenu, setHasSubscriptionsMenu] = useState(() => readMenuHasPath('/subscriptions'));

  useEffect(() => {
    const syncMenuFlags = () => {
      setHasInvestmentsMenu(readMenuHasPath('/investments'));
      setHasGoldMenu(readMenuHasPath('/gold'));
      setHasSubscriptionsMenu(readMenuHasPath('/subscriptions'));
    };
    syncMenuFlags();
    window.addEventListener(MENU_CACHE_UPDATED_EVENT, syncMenuFlags);
    return () => window.removeEventListener(MENU_CACHE_UPDATED_EVENT, syncMenuFlags);
  }, []);

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

  const [goldResources, setGoldResources] = useState<GoldResource[]>([]);
  const [goldResLoading, setGoldResLoading] = useState(false);

  const [grModalOpen, setGrModalOpen] = useState(false);
  const [grEditingId, setGrEditingId] = useState<string | undefined>();
  const [grType, setGrType] = useState<'person' | 'location'>('person');
  const [grName, setGrName] = useState('');
  const [grSkip, setGrSkip] = useState(false);
  const [grBusy, setGrBusy] = useState(false);
  const [grDelConfirm, setGrDelConfirm] = useState(false);

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
  const [fintrackerSaving, setFintrackerSaving] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<{ currency?: 'INR' | 'USD' | 'AED'; roundOff?: boolean }>({
    currency: 'INR',
    roundOff: true,
  });
  const [currencySaving, setCurrencySaving] = useState(false);
  const [upstoxUiOpen, setUpstoxUiOpen] = useState(true);

  useLayoutEffect(() => {
    const c = readSettingsPageCache();
    if (!c) return;
    setSettings(c.settingsFields);
    setProfile(c.profile);
    if (c.fintrackerDraft?.expenseCycle) {
      setFintrackerDraft(c.fintrackerDraft);
    }
    setSettingsDraft(c.settingsDraft ?? { currency: 'INR', roundOff: true });
    setUpstoxStatus(c.upstoxStatus ?? { hasToken: false });
    if (c.upstoxStatusState === 'checking') {
      setUpstoxStatusState(c.upstoxStatus.hasToken ? 'connected' : 'missing');
    } else {
      setUpstoxStatusState(c.upstoxStatusState);
    }
    if (c.goldResources && Array.isArray(c.goldResources)) {
      setGoldResources(c.goldResources);
    }
    setLoading(false);
  }, []);

  const validateLiveStatus = useCallback(async (arg: ValidateLiveArg = {}) => {
    const opts = typeof arg === 'boolean' ? { forceInvalidate: arg, background: false } : arg
    const { forceInvalidate = false, background = false } = opts
    if (!background) {
      setLoading(true)
    }
    setError('')
    if (!background) {
      setUpstoxStatusState('checking')
    }
    try {
      if (forceInvalidate) api.invalidateCache({ action: 'get', params: { module: 'settings' } })
      const [settingsResult, tokenResult, profileResult] = await Promise.allSettled([
        api.getSettings(),
        api.getTokenStatus(),
        api.getProfile(),
      ])
      const loaded: Record<string, string> = {}
      let nextFintracker: FintrackerPrefs | undefined
      let nextSettingsDraft: { currency?: 'INR' | 'USD' | 'AED'; roundOff?: boolean } | undefined

      if (settingsResult.status === 'fulfilled') {
        loaded[String(GOLD_RATE_FIELD.key)] = String(
          settingsResult.value[GOLD_RATE_FIELD.key as keyof typeof settingsResult.value] || '',
        )
        loaded.usdToInr =
          settingsResult.value.usdToInr !== undefined ? String(settingsResult.value.usdToInr) : ''
        const ft = settingsResult.value.fintracker
        if (ft && typeof ft === 'object' && ft.expenseCycle) {
          const draft: FintrackerPrefs = {
            expenseCycle: {
              mode: ft.expenseCycle.mode === 'custom' ? 'custom' : 'regular',
              anchorDay: Math.min(31, Math.max(2, Math.floor(Number(ft.expenseCycle.anchorDay)) || 19)),
            },
          }
          setFintrackerDraft(draft)
          nextFintracker = draft
        } else {
          const draft = { expenseCycle: { ...DEFAULT_FINTRACKER_PREFS.expenseCycle } }
          setFintrackerDraft(draft)
          nextFintracker = draft
        }
        const sd = {
          currency: (settingsResult.value.currency as 'INR' | 'USD' | 'AED') || 'INR',
          roundOff: settingsResult.value.roundOff !== false,
        }
        setSettingsDraft(sd)
        nextSettingsDraft = sd
        setSettings(loaded)
      } else if (!background) {
        setSettings({})
      }

      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value)
      } else if (!background) {
        setProfile(null)
      }

      if (tokenResult.status === 'fulfilled') {
        setUpstoxStatus(tokenResult.value)
        const isConnected = Boolean(tokenResult.value.hasToken)
        setUpstoxStatusState(isConnected ? 'connected' : 'missing')
      } else if (!background) {
        setUpstoxStatus({ hasToken: false })
        setUpstoxStatusState('missing')
      }

      const cachePatch: Partial<Omit<SettingsPageCachePayload, 'fetchedAt'>> = {}
      if (settingsResult.status === 'fulfilled') {
        cachePatch.settingsFields = loaded
        if (nextFintracker) cachePatch.fintrackerDraft = nextFintracker
        if (nextSettingsDraft) cachePatch.settingsDraft = nextSettingsDraft
      }
      if (profileResult.status === 'fulfilled') {
        cachePatch.profile = profileResult.value
      }
      if (tokenResult.status === 'fulfilled') {
        cachePatch.upstoxStatus = tokenResult.value
        cachePatch.upstoxStatusState = tokenResult.value.hasToken ? 'connected' : 'missing'
      }
      if (
        cachePatch.settingsFields !== undefined ||
        cachePatch.profile !== undefined ||
        cachePatch.upstoxStatus !== undefined
      ) {
        mergeWriteSettingsPageCache(cachePatch)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings')
      if (!background) {
        setUpstoxStatusState('missing')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void validateLiveStatus({ background: readSettingsPageCache() !== null })
  }, [validateLiveStatus])

  useEffect(() => {
    setMoneyModalOpen(false);
    setGrModalOpen(false);
    setAcctDelConfirm(false);
    setCrDelConfirm(false);
    setGrDelConfirm(false);
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

  async function saveCurrencySettings() {
    setCurrencySaving(true);
    setError('');
    try {
      await api.saveSettings({
        currency: settingsDraft.currency,
        roundOff: settingsDraft.roundOff,
      });
      window.dispatchEvent(new Event('currency:settings'));
      await validateLiveStatus(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setCurrencySaving(false);
    }
  }

  function startEdit(key: string) {
    setEditingKey(key);
    setEditValue(settings[key] ?? '');
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

  function resetCrForm() {
    setCrId(undefined);
    setCrName('');
    setCrDesc('');
    setCrCat('credit_card');
  }

  function closeMoneyModal() {
    setMoneyModalOpen(false);
    resetAcctForm();
    resetCrForm();
    setAcctDelConfirm(false);
    setCrDelConfirm(false);
  }

  function startEditAccount(a: AccountRow) {
    resetCrForm();
    setMoneyModalKind('account');
    setAcctDelConfirm(false);
    setAcctId(a.id);
    setAcctName(a.name);
    setAcctDesc(a.description ?? '');
    setAcctUsed((a.usedFor as AccountUsedFor) || 'both');
    setMoneyModalOpen(true);
  }

  async function submitMoney(e: FormEvent) {
    e.preventDefault();
    const isAccount = Boolean(acctId) || (!crId && moneyModalKind === 'account');
    if (isAccount) {
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
        closeMoneyModal();
        setAcctDelConfirm(false);
        await refreshModes();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setAcctBusy(false);
      }
    } else {
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
        closeMoneyModal();
        setCrDelConfirm(false);
        await refreshModes();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setCrBusy(false);
      }
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
      closeMoneyModal();
      setAcctDelConfirm(false);
      await refreshModes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function startEditCredit(c: CreditSourceRow) {
    resetAcctForm();
    setMoneyModalKind('credit');
    setCrDelConfirm(false);
    setCrId(c.id);
    setCrName(c.name);
    setCrDesc(c.description ?? '');
    setCrCat((c.category as CreditSourceCategory) || 'credit_card');
    setMoneyModalOpen(true);
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
      closeMoneyModal();
      setCrDelConfirm(false);
      await refreshModes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const loadGoldResources = useCallback(
    async (force = false) => {
      if (!hasGoldMenu) return;
      const snap = readSettingsPageCache();
      const fromCache = !force ? snap?.goldResources : undefined;
      const hasCachedGold = fromCache !== undefined && Array.isArray(fromCache);
      if (hasCachedGold) {
        setGoldResources(fromCache);
      }
      if (!hasCachedGold || force) {
        setGoldResLoading(true);
      }
      setError('');
      try {
        if (force) api.invalidateCache({ action: 'getResources', params: { module: 'gold' } });
        const rows = await api.getGoldResources();
        setGoldResources(rows);
        mergeWriteSettingsPageCache({ goldResources: rows });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load gold setup');
      } finally {
        setGoldResLoading(false);
      }
    },
    [hasGoldMenu],
  );

  useEffect(() => {
    if (settingsTab === 'gold' && hasGoldMenu) void loadGoldResources();
  }, [settingsTab, hasGoldMenu, loadGoldResources]);

  function openAddAccount() {
    setMoneyModalKind('account');
    resetAcctForm();
    resetCrForm();
    setAcctDelConfirm(false);
    setMoneyModalOpen(true);
  }

  function openAddCredit(category: CreditSourceCategory) {
    setMoneyModalKind('credit');
    resetAcctForm();
    resetCrForm();
    setCrCat(category);
    setCrDelConfirm(false);
    setMoneyModalOpen(true);
  }

  function openAddGoldResource(type: 'person' | 'location') {
    setGrEditingId(undefined);
    setGrType(type);
    setGrName('');
    setGrSkip(false);
    setGrDelConfirm(false);
    setGrModalOpen(true);
  }

  function startEditGoldResource(r: GoldResource) {
    setGrEditingId(r.id);
    setGrType(r.type);
    setGrName(r.name);
    setGrSkip(r.skip);
    setGrDelConfirm(false);
    setGrModalOpen(true);
  }

  function closeGrModal() {
    setGrModalOpen(false);
    setGrEditingId(undefined);
    setGrName('');
    setGrSkip(false);
    setGrDelConfirm(false);
  }

  async function submitGoldResource(e: FormEvent) {
    e.preventDefault();
    if (!grName.trim()) return;
    setGrBusy(true);
    setError('');
    try {
      const skip = grType === 'location' ? grSkip : false;
      if (grEditingId) {
        await api.updateGoldResource({ id: grEditingId, type: grType, name: grName.trim(), skip });
      } else {
        await api.addGoldResource({ type: grType, name: grName.trim(), skip });
      }
      closeGrModal();
      await loadGoldResources(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setGrBusy(false);
    }
  }

  async function deleteGoldResourceFromModal() {
    if (!grEditingId) return;
    if (!grDelConfirm) {
      setGrDelConfirm(true);
      return;
    }
    setError('');
    try {
      await api.deleteGoldResource(grEditingId);
      closeGrModal();
      await loadGoldResources(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const showAccountFields = Boolean(acctId) || (!crId && moneyModalKind === 'account');

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
        {hasGoldMenu ? (
          <button
            type="button"
            className={`bottom-nav-item${settingsTab === 'gold' ? ' active' : ''}`}
            onClick={() => setSettingsTab('gold')}
          >
            <span className="bottom-nav-icon"><Gem size={19} /></span>
            <span>Gold</span>
          </button>
        ) : null}
      </nav>

      <div className="pg savings-page">
        {settingsTab === 'general' && (
          <>
            {profile ? (
              <SectionBlock title="Profile" icon={<User size={14} aria-hidden />}>
                <div className="txn-cards">
                  <div
                    className={`${GENERAL_SETTINGS_PANEL} txn-entry-card--compact`}
                    role="group"
                  >
                    <div className="settings-profile-card-body">
                      <div className="settings-profile-card-top">
                        <div className="settings-profile-name">
                          {(profile.displayName && profile.displayName.trim()) || profile.email}
                        </div>
                        {profile.displayName?.trim() ? (
                          <div className="settings-profile-email">{profile.email}</div>
                        ) : null}
                      </div>
                      <div className="settings-profile-org-row">
                        <span className="settings-profile-meta-label">Organization</span>
                        <span className="settings-profile-meta-value settings-profile-meta-value--end">
                          {profile.activeOrgId
                            ? profile.orgs.find((o) => o.id === profile.activeOrgId)?.name ?? 'Unknown org'
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionBlock>
            ) : null}

            {loading && (
              <>
                {profile ? <Spacer size={6} /> : null}
                <LoadingState variant="section" />
              </>
            )}

            {!loading &&
            !modesLoading &&
            monthlyAccountNames.length > 0 &&
            savingsAccountNames.length > 0 ? (
              <SectionBlock title="Billing cycle" icon={<CalendarRange size={14} aria-hidden />}>
                <div className="txn-cards">
                  <div className={GENERAL_SETTINGS_PANEL} role="group">
                    <div className="ui-stack settings-general-card-stack">
                    <p className="settings-billing-hint">
                      <strong style={{ color: 'var(--text)' }}>Regular</strong> — 1st through last day of each calendar month.{' '}
                      <strong style={{ color: 'var(--text)' }}>Custom</strong> — from your anchor day last month through the day before the same anchor this month.
                    </p>
                    <FormField label="Cycle">
                      <select
                        className="form-inp settings-general-fullwidth-control"
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
                        <option value="regular">Calendar month</option>
                        <option value="custom">Custom (anchored month)</option>
                      </select>
                    </FormField>
                    {fintrackerDraft.expenseCycle.mode === 'custom' ? (
                      <FormField label="Anchor day">
                        <input
                          className="form-inp"
                          type="number"
                          min={2}
                          max={31}
                          title="Day of month (2–31). The period starts on this day last month and ends the day before this day in the current month."
                          aria-label="Anchor day of month, 2 through 31"
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
                    <p className="settings-billing-example">
                      Example — May 2026:{' '}
                      <strong>{cycleSubtitle('May', '2026', fintrackerDraft)}</strong>
                      {' · '}
                      {(() => {
                        try {
                          const r = cycleDateRange('May', '2026', fintrackerDraft)
                          return `${r.start} → ${r.end}`
                        } catch {
                          return ''
                        }
                      })()}
                    </p>
                    <button
                      type="button"
                      className="ui-kit-btn ui-kit-btn--solid ui-kit-btn-inline settings-action-btn settings-general-save-btn"
                      onClick={() => void saveFintrackerPrefs()}
                      disabled={fintrackerSaving}
                    >
                      {fintrackerSaving ? <Loader2 size={14} className="spin-icon" /> : null}
                      Save
                    </button>
                    </div>
                  </div>
                </div>
              </SectionBlock>
            ) : null}

            {hasInvestmentsMenu ? (
              <SectionBlock title="Integrations" icon={<Plug size={14} aria-hidden />}>
                <div className="txn-cards">
                  <div className={GENERAL_SETTINGS_PANEL} role="group">
                    <div className="settings-upstox-toggle-row">
                      <span className="settings-upstox-toggle-label">Upstox</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={upstoxUiOpen}
                        className={`settings-switch${upstoxUiOpen ? ' settings-switch--on' : ''}`}
                        onClick={() => setUpstoxUiOpen((v) => !v)}
                        aria-label={upstoxUiOpen ? 'Hide Upstox connection controls' : 'Show Upstox connection controls'}
                      />
                    </div>
                    {upstoxUiOpen ? (
                      <div className="ui-stack settings-general-card-stack settings-upstox-body">
                      <div className="settings-upstox-status-row">
                        <span className="settings-upstox-status-label">Status</span>
                        <SectionChip>
                          {upstoxStatusState === 'checking' ? '…' : upstoxStatusState === 'connected' ? 'Connected' : 'Not connected'}
                        </SectionChip>
                      </div>
                      {(upstoxStatus.hasAccessToken !== undefined ||
                        upstoxStatus.hasRefreshToken !== undefined ||
                        upstoxStatus.expired !== undefined) && (
                        <div className="settings-upstox-token-lines">
                          {upstoxStatus.hasAccessToken !== undefined ? (
                            <div>Access token: {upstoxStatus.hasAccessToken ? 'yes' : 'no'}</div>
                          ) : null}
                          {upstoxStatus.hasExtendedToken !== undefined ? (
                            <div>Extended token: {upstoxStatus.hasExtendedToken ? 'yes' : 'no'}</div>
                          ) : null}
                          {upstoxStatus.hasRefreshToken !== undefined ? (
                            <div>Refresh token: {upstoxStatus.hasRefreshToken ? 'yes' : 'no'}</div>
                          ) : null}
                          {upstoxStatus.expired !== undefined ? (
                            <div>Expired: {upstoxStatus.expired ? 'yes' : 'no'}</div>
                          ) : null}
                        </div>
                      )}
                      <div className="settings-actions settings-general-upstox-actions">
                        <button
                          type="button"
                          className="ui-kit-btn ui-kit-btn--solid ui-kit-btn-inline settings-action-btn"
                          onClick={() => void connectUpstox()}
                          disabled={upstoxBusy}
                        >
                          <Link2 size={14} />
                          {upstoxStatus.hasToken ? 'Re-login' : 'Connect'}
                        </button>
                        <button
                          type="button"
                          className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline settings-action-btn"
                          onClick={() => void clearUpstox()}
                          disabled={upstoxBusy || !upstoxStatus.hasToken}
                        >
                          <Unlink2 size={14} />
                          Logout
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="settings-upstox-collapsed-hint">
                      Turn on to connect or manage your Upstox session.
                    </p>
                  )}
                  </div>
                </div>
              </SectionBlock>
            ) : null}

            {!loading && hasSubscriptionsMenu ? (
              <SectionBlock title="Rates" icon={<ArrowRightLeft size={14} aria-hidden />}>
                <div className="txn-cards">
                  <div className={GENERAL_SETTINGS_PANEL} role="group">
                    <div className="settings-rates-usd-block">
                      <div className="settings-profile-meta-label">USD → INR</div>
                      <div className="settings-gold-usd-value">
                        {settings.usdToInr
                          ? formatCurrency(Number(settings.usdToInr), 'INR', false)
                          : '—'}
                      </div>
                      <div className="settings-gold-usd-note">From settings API when available</div>
                    </div>
                  </div>
                </div>
              </SectionBlock>
            ) : null}

            {!loading ? (
              <SectionBlock title="Currency & Display" icon={<DollarSign size={14} aria-hidden />}>
                <div className="txn-cards">
                  <div className={GENERAL_SETTINGS_PANEL} role="group">
                    <div className="ui-stack settings-general-card-stack">
                      <FormField label="Currency">
                        <select
                          className="form-inp settings-general-fullwidth-control"
                          value={settingsDraft.currency || 'INR'}
                          onChange={(e) =>
                            setSettingsDraft((prev) => ({
                              ...prev,
                              currency: e.target.value as 'INR' | 'USD' | 'AED',
                            }))
                          }
                        >
                          <option value="INR">INR (₹)</option>
                          <option value="USD">USD ($)</option>
                          <option value="AED">AED (د.إ)</option>
                        </select>
                      </FormField>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: '0.75rem' }}>
                        <label style={{ flex: 1, marginBottom: 0 }} htmlFor="roundoff-toggle">
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Round off amounts</span>
                        </label>
                        <button
                          id="roundoff-toggle"
                          type="button"
                          role="switch"
                          aria-checked={settingsDraft.roundOff !== false}
                          className={`settings-switch${settingsDraft.roundOff !== false ? ' settings-switch--on' : ''}`}
                          onClick={() =>
                            setSettingsDraft((prev) => ({
                              ...prev,
                              roundOff: !prev.roundOff,
                            }))
                          }
                          aria-label={settingsDraft.roundOff !== false ? 'Round off amounts' : 'Show decimals'}
                        />
                      </div>
                      <button
                        type="button"
                        className="ui-kit-btn ui-kit-btn--solid ui-kit-btn-inline settings-action-btn settings-general-save-btn"
                        onClick={() => void saveCurrencySettings()}
                        disabled={currencySaving}
                      >
                        {currencySaving ? <Loader2 size={14} className="spin-icon" /> : null}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </SectionBlock>
            ) : null}
          </>
        )}

        {settingsTab === 'accounts' && (
          <>
            <SectionBlock
              title="Payment accounts"
              icon={<Wallet size={14} />}
              right={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <SectionChip>{dbAccounts.length}</SectionChip>
                  <button
                    type="button"
                    className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline"
                    onClick={openAddAccount}
                    aria-label="Add payment account"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                  </button>
                </span>
              }
            >
              {modesLoading ? (
                <LoadingState variant="section" />
              ) : dbAccounts.length === 0 ? (
                <p style={{ color: 'var(--muted)', padding: '0.25rem 0', fontSize: 14 }}>
                  No accounts yet. Use + above to add one.
                </p>
              ) : (
                <div className="txn-cards">
                  {dbAccounts.map((a) => (
                    <TransactionCard
                      key={a.id}
                      compact
                      title={a.name}
                      tone="navy"
                      icon={accountNameIcon(a.name)}
                      onClick={() => startEditAccount(a)}
                    />
                  ))}
                </div>
              )}
            </SectionBlock>

            <Spacer size={6} />

            <SectionBlock
              title="Credit cards"
              icon={<CreditCard size={14} />}
              right={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <SectionChip>{dbCredits.filter((c) => c.category === 'credit_card').length}</SectionChip>
                  <button
                    type="button"
                    className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline"
                    onClick={() => openAddCredit('credit_card')}
                    aria-label="Add credit card"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                  </button>
                </span>
              }
            >
              {modesLoading ? (
                <LoadingState variant="section" />
              ) : dbCredits.filter((c) => c.category === 'credit_card').length === 0 ? (
                <p style={{ color: 'var(--muted)', padding: '0.25rem 0', fontSize: 14 }}>
                  No cards yet. Use + above to add.
                </p>
              ) : (
                <div className="txn-cards">
                  {dbCredits
                    .filter((c) => c.category === 'credit_card')
                    .map((c) => (
                      <TransactionCard
                        key={c.id}
                        compact
                        title={c.name}
                        tone="red"
                        icon={<CreditCard size={14} />}
                        onClick={() => startEditCredit(c)}
                      />
                    ))}
                </div>
              )}
            </SectionBlock>

            <Spacer size={6} />

            <SectionBlock
              title="Other credits"
              icon={<Users size={14} />}
              right={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <SectionChip>{dbCredits.filter((c) => c.category === 'informal').length}</SectionChip>
                  <button
                    type="button"
                    className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline"
                    onClick={() => openAddCredit('informal')}
                    aria-label="Add informal credit"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                  </button>
                </span>
              }
            >
              {modesLoading ? (
                <LoadingState variant="section" />
              ) : dbCredits.filter((c) => c.category === 'informal').length === 0 ? (
                <p style={{ color: 'var(--muted)', padding: '0.25rem 0', fontSize: 14 }}>
                  No informal credits yet. Use + above to add.
                </p>
              ) : (
                <div className="txn-cards">
                  {dbCredits
                    .filter((c) => c.category === 'informal')
                    .map((c) => (
                      <TransactionCard
                        key={c.id}
                        compact
                        title={c.name}
                        tone="amber"
                        icon={<Users size={14} />}
                        onClick={() => startEditCredit(c)}
                      />
                    ))}
                </div>
              )}
            </SectionBlock>
          </>
        )}

        {settingsTab === 'gold' && hasGoldMenu && (
          <>
            <SectionBlock title="Gold rate" icon={<Coins size={14} aria-hidden />}>
              <div className="txn-cards">
                {loading ? (
                  <LoadingState variant="section" />
                ) : (
                  <SettingsSectionCard
                    field={GOLD_RATE_FIELD}
                    value={settings[GOLD_RATE_FIELD.key] || ''}
                    editing={editingKey === GOLD_RATE_FIELD.key}
                    saving={saving}
                    editValue={editValue}
                    onStartEdit={() => startEdit(String(GOLD_RATE_FIELD.key))}
                    onChange={setEditValue}
                    onSave={(value) => saveField(String(GOLD_RATE_FIELD.key), value)}
                  />
                )}
              </div>
            </SectionBlock>

            <Spacer size={6} />

            <SectionBlock
              title="People"
              icon={<User size={14} />}
              right={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <SectionChip>{goldResources.filter((r) => r.type === 'person').length}</SectionChip>
                  <button
                    type="button"
                    className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline"
                    onClick={() => openAddGoldResource('person')}
                    aria-label="Add person"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                  </button>
                </span>
              }
            >
              {goldResLoading ? (
                <LoadingState variant="section" />
              ) : goldResources.filter((r) => r.type === 'person').length === 0 ? (
                <p style={{ color: 'var(--muted)', padding: '0.25rem 0', fontSize: 14 }}>No people yet.</p>
              ) : (
                <div className="txn-cards">
                  {goldResources
                    .filter((r) => r.type === 'person')
                    .map((r) => (
                      <TransactionCard
                        key={r.id}
                        compact
                        title={r.name}
                        tone="navy"
                        icon={<User size={14} />}
                        onClick={() => startEditGoldResource(r)}
                      />
                    ))}
                </div>
              )}
            </SectionBlock>

            <Spacer size={6} />

            <SectionBlock
              title="Locations"
              icon={<MapPin size={14} />}
              right={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <SectionChip>{goldResources.filter((r) => r.type === 'location').length}</SectionChip>
                  <button
                    type="button"
                    className="ui-kit-btn ui-kit-btn--soft ui-kit-btn-inline"
                    onClick={() => openAddGoldResource('location')}
                    aria-label="Add location"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                  </button>
                </span>
              }
            >
              {goldResLoading ? (
                <LoadingState variant="section" />
              ) : goldResources.filter((r) => r.type === 'location').length === 0 ? (
                <p style={{ color: 'var(--muted)', padding: '0.25rem 0', fontSize: 14 }}>No locations yet.</p>
              ) : (
                <div className="txn-cards">
                  {goldResources
                    .filter((r) => r.type === 'location')
                    .map((r) => (
                      <TransactionCard
                        key={r.id}
                        compact
                        title={r.skip ? `${r.name} · excluded from estimate` : r.name}
                        tone={r.skip ? 'red' : 'navy'}
                        icon={<MapPin size={14} />}
                        onClick={() => startEditGoldResource(r)}
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

      {moneyModalOpen && (
        <div className="modal-bg open" onClick={closeMoneyModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-hd modal-hd--blue">
              <span className="modal-title">
                {acctId
                  ? 'Edit payment account'
                  : crId
                    ? 'Edit credit source'
                    : moneyModalKind === 'account'
                      ? 'Add payment account'
                      : 'Add credit source'}
              </span>
              <button type="button" className="modal-close" onClick={closeMoneyModal}>
                ×
              </button>
            </div>
            <form onSubmit={submitMoney}>
              <div className="modal-body">
                <div className="ui-stack">
                  {!acctId && !crId ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                      <button
                        type="button"
                        className={`ui-kit-btn ui-kit-btn-inline${moneyModalKind === 'account' ? ' ui-kit-btn--solid' : ' ui-kit-btn--soft'}`}
                        onClick={() => setMoneyModalKind('account')}
                      >
                        Payment account
                      </button>
                      <button
                        type="button"
                        className={`ui-kit-btn ui-kit-btn-inline${moneyModalKind === 'credit' ? ' ui-kit-btn--solid' : ' ui-kit-btn--soft'}`}
                        onClick={() => setMoneyModalKind('credit')}
                      >
                        Credit source
                      </button>
                    </div>
                  ) : null}
                  {showAccountFields ? (
                    <>
                      <FormField label="Name">
                        <input
                          className="form-inp"
                          value={acctName}
                          onChange={(e) => setAcctName(e.target.value)}
                          required
                        />
                      </FormField>
                      <FormField label="Description">
                        <input className="form-inp" value={acctDesc} onChange={(e) => setAcctDesc(e.target.value)} />
                      </FormField>
                      <FormField label="Used for">
                        <select
                          className="form-sel"
                          value={acctUsed}
                          onChange={(e) => setAcctUsed(e.target.value as AccountUsedFor)}
                        >
                          <option value="savings">Savings</option>
                          <option value="monthly">Monthly expenses</option>
                          <option value="both">Both</option>
                        </select>
                      </FormField>
                    </>
                  ) : (
                    <>
                      <FormField label="Name">
                        <input
                          className="form-inp"
                          value={crName}
                          onChange={(e) => setCrName(e.target.value)}
                          required
                        />
                      </FormField>
                      <FormField label="Description">
                        <input className="form-inp" value={crDesc} onChange={(e) => setCrDesc(e.target.value)} />
                      </FormField>
                      <FormField label="Category">
                        <select
                          className="form-sel"
                          value={crCat}
                          onChange={(e) => setCrCat(e.target.value as CreditSourceCategory)}
                        >
                          <option value="credit_card">Credit card</option>
                          <option value="informal">Other / informal</option>
                        </select>
                      </FormField>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-foot">
                {acctId ? (
                  <button type="button" className="btn btn-sm btn-red" onClick={() => void deleteAccountFromModal()}>
                    {acctDelConfirm ? 'Confirm delete?' : 'Delete'}
                  </button>
                ) : crId ? (
                  <button type="button" className="btn btn-sm btn-red" onClick={() => void deleteCreditFromModal()}>
                    {crDelConfirm ? 'Confirm delete?' : 'Delete'}
                  </button>
                ) : (
                  <span />
                )}
                <div className="modal-foot-l" />
                <button
                  type="button"
                  className="btn btn-sm btn-cancel"
                  onClick={closeMoneyModal}
                  disabled={acctBusy || crBusy}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm btn-green" disabled={acctBusy || crBusy}>
                  {acctBusy || crBusy
                    ? 'Saving…'
                    : showAccountFields
                      ? acctId
                        ? 'Save'
                        : 'Add'
                      : crId
                        ? 'Save'
                        : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {grModalOpen && (
        <div className="modal-bg open" onClick={closeGrModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-hd modal-hd--blue">
              <span className="modal-title">
                {grEditingId ? `Edit ${grType === 'person' ? 'person' : 'location'}` : `Add ${grType === 'person' ? 'person' : 'location'}`}
              </span>
              <button type="button" className="modal-close" onClick={closeGrModal}>
                ×
              </button>
            </div>
            <form onSubmit={submitGoldResource}>
              <div className="modal-body">
                <div className="ui-stack">
                  {!grEditingId ? (
                    <FormField label="Type">
                      <select
                        className="form-sel"
                        value={grType}
                        onChange={(e) => {
                          const v = e.target.value === 'location' ? 'location' : 'person';
                          setGrType(v);
                          if (v === 'person') setGrSkip(false);
                        }}
                      >
                        <option value="person">Person</option>
                        <option value="location">Location</option>
                      </select>
                    </FormField>
                  ) : null}
                  <FormField label="Name">
                    <input className="form-inp" value={grName} onChange={(e) => setGrName(e.target.value)} required />
                  </FormField>
                  {grType === 'location' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                      <input type="checkbox" checked={grSkip} onChange={(e) => setGrSkip(e.target.checked)} />
                      Exclude from estimated gold value (e.g. bank-held)
                    </label>
                  ) : null}
                </div>
              </div>
              <div className="modal-foot">
                {grEditingId ? (
                  <button type="button" className="btn btn-sm btn-red" onClick={() => void deleteGoldResourceFromModal()}>
                    {grDelConfirm ? 'Confirm delete?' : 'Delete'}
                  </button>
                ) : (
                  <span />
                )}
                <div className="modal-foot-l" />
                <button type="button" className="btn btn-sm btn-cancel" onClick={closeGrModal} disabled={grBusy}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm btn-green" disabled={grBusy}>
                  {grBusy ? 'Saving…' : grEditingId ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

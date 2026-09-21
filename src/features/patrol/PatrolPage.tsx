import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { IconRefreshCw } from '@/components/ui/icons';
import { SectionCard } from '@/features/config/components/SectionCard';
import {
  FieldGrid,
  FIELDS_ROOT_CLASS,
  ToggleRow,
} from '@/features/config/components/fields/FieldPrimitives';
import { ProviderTabs } from '@/features/authFiles/components/ProviderTabs';
import { getAuthFileIcon, getTypeLabel } from '@/features/authFiles/constants';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useRevealGroup } from '@/hooks/motion';
import { useNow } from '@/hooks/useNow';
import { buddyPatrolApi } from '@/services/api/buddyPatrol';
import { useAuthStore, useNotificationStore, useThemeStore } from '@/stores';
import { getErrorMessage } from '@/utils/helpers';
import { formatInstantShort, formatRelativeInstant } from '@/utils/quota';
import { parseTimestamp } from '@/utils/timestamp';
import {
  defaultActivitySettings,
  defaultCreditsSettings,
  isValidGoDuration,
  patrolResultTone,
  settingsDirty,
  toPatrolPatchBody,
} from './logic';
import type { BuddyPatrolState, PatrolAccount, PatrolLastResult, PatrolSettings } from './types';
import styles from './PatrolPage.module.scss';

const ACCOUNT_TABS = ['all', 'codebuddy', 'workbuddy'];

const emptyState = (): BuddyPatrolState => ({
  homeMode: false,
  credits: defaultCreditsSettings(),
  activity: defaultActivitySettings(),
  accounts: [],
});

export function PatrolPage() {
  const { t, i18n } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const showNotification = useNotificationStore((state) => state.showNotification);
  const revealRef = useRevealGroup<HTMLDivElement>();
  const now = useNow();

  const [state, setState] = useState<BuddyPatrolState>(emptyState);
  const [creditsDraft, setCreditsDraft] = useState<PatrolSettings>(defaultCreditsSettings);
  const [activityDraft, setActivityDraft] = useState<PatrolSettings>(defaultActivitySettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingKind, setSavingKind] = useState<'credits' | 'activity' | null>(null);
  const [tab, setTab] = useState('all');

  const disableControls = connectionStatus !== 'connected' || savingKind !== null;

  const applyState = useCallback((next: BuddyPatrolState) => {
    setState(next);
    setCreditsDraft(next.credits);
    setActivityDraft(next.activity);
  }, []);

  const load = useCallback(async () => {
    setError('');
    try {
      const next = await buddyPatrolApi.get();
      applyState(next);
    } catch (err) {
      setError(getErrorMessage(err, t('patrol.load_error')));
    } finally {
      setLoading(false);
    }
  }, [applyState, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useHeaderRefresh(load, connectionStatus === 'connected');

  const patchAndReload = useCallback(
    async (kind: 'credits' | 'activity', body: Record<string, unknown>) => {
      setSavingKind(kind);
      try {
        await buddyPatrolApi.patch(body);
        const next = await buddyPatrolApi.get();
        applyState(next);
        showNotification(t('patrol.saved'), 'success');
      } catch (err) {
        showNotification(getErrorMessage(err, t('patrol.save_failed')), 'error');
      } finally {
        setSavingKind(null);
      }
    },
    [applyState, showNotification, t]
  );

  const handleToggle = useCallback(
    (kind: 'credits' | 'activity', enabled: boolean) => {
      void patchAndReload(kind, toPatrolPatchBody(kind, { enabled }));
    },
    [patchAndReload]
  );

  const handleSave = useCallback(
    (kind: 'credits' | 'activity') => {
      const draft = kind === 'credits' ? creditsDraft : activityDraft;
      if (!isValidGoDuration(draft.interval) || !isValidGoDuration(draft.minAccountInterval)) {
        showNotification(t('patrol.invalid_duration'), 'error');
        return;
      }
      if (kind === 'activity' && !draft.model.trim()) {
        showNotification(t('patrol.invalid_model'), 'error');
        return;
      }
      void patchAndReload(
        kind,
        toPatrolPatchBody(kind, {
          interval: draft.interval,
          minAccountInterval: draft.minAccountInterval,
          ...(kind === 'activity' ? { model: draft.model } : {}),
        })
      );
    },
    [activityDraft, creditsDraft, patchAndReload, showNotification, t]
  );

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: state.accounts.length, codebuddy: 0, workbuddy: 0 };
    state.accounts.forEach((account) => {
      counts[account.provider] = (counts[account.provider] ?? 0) + 1;
    });
    return counts;
  }, [state.accounts]);

  const visibleAccounts = useMemo(
    () =>
      tab === 'all' ? state.accounts : state.accounts.filter((account) => account.provider === tab),
    [state.accounts, tab]
  );

  const creditsDirty = settingsDirty(creditsDraft, state.credits, false);
  const activityDirty = settingsDirty(activityDraft, state.activity, true);

  const renderLast = (account: PatrolAccount, kind: 'credits' | 'activity') => {
    if (kind === 'activity' && !account.activityEligible) {
      return <span className={styles.muted}>{t('patrol.not_applicable')}</span>;
    }
    const last: PatrolLastResult | undefined = kind === 'credits' ? account.credits : account.activity;
    if (!last?.result && !last?.at) {
      return <span className={styles.muted}>{t('patrol.never')}</span>;
    }
    const tone = patrolResultTone(last.result);
    const resultKey = last.result ? `patrol.result_${last.result}` : '';
    const resultLabel = last.result ? t(resultKey) : '';
    const atMs = last.at ? parseTimestamp(last.at)?.getTime() : undefined;
    return (
      <div className={styles.last}>
        {last.result ? <span className={`${styles.pill} ${styles[tone]}`}>{resultLabel}</span> : null}
        {kind === 'credits' && last.remain !== undefined ? (
          <span className={styles.remain}>{t('patrol.remain', { value: last.remain })}</span>
        ) : null}
        {atMs ? (
          <span className={styles.when} title={formatInstantShort(atMs)}>
            {formatRelativeInstant(atMs, now, i18n.resolvedLanguage)}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className={styles.page} ref={revealRef}>
      <header className={styles.header}>
        <div className={styles.copy}>
          <h1 className={styles.title} data-reveal>
            {t('patrol.title')}
          </h1>
          <p className={styles.meta} data-reveal>
            <span>{t('patrol.meta_accounts', { count: state.accounts.length })}</span>
            {state.homeMode ? (
              <>
                <span className={styles.metaDot} aria-hidden="true">
                  ·
                </span>
                <span className={styles.metaWarn}>{t('patrol.home_mode')}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className={styles.actions} data-reveal>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => {
              setLoading(true);
              void load();
            }}
            disabled={disableControls || loading}
          >
            <IconRefreshCw size={14} className={loading ? styles.spinning : undefined} />
            {t('common.refresh')}
          </button>
        </div>
      </header>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      <div className={styles.cards}>
        <SectionCard
          title={t('patrol.credits_title')}
          description={t('patrol.credits_description')}
          animateIn
        >
          <ToggleRow
            title={t('patrol.enabled')}
            description={t('patrol.credits_enabled_hint')}
            checked={creditsDraft.enabled}
            disabled={disableControls}
            onChange={(enabled) => handleToggle('credits', enabled)}
          />
          <div className={FIELDS_ROOT_CLASS}>
            <FieldGrid>
              <Input
                label={t('patrol.interval')}
                hint={t('patrol.interval_hint')}
                value={creditsDraft.interval}
                disabled={disableControls}
                onChange={(event) =>
                  setCreditsDraft((prev) => ({ ...prev, interval: event.target.value }))
                }
              />
              <Input
                label={t('patrol.min_account_interval')}
                hint={t('patrol.min_account_interval_hint')}
                value={creditsDraft.minAccountInterval}
                disabled={disableControls}
                onChange={(event) =>
                  setCreditsDraft((prev) => ({ ...prev, minAccountInterval: event.target.value }))
                }
              />
            </FieldGrid>
          </div>
          <div className={styles.cardActions}>
            <Button
              size="sm"
              disabled={disableControls || !creditsDirty}
              loading={savingKind === 'credits'}
              onClick={() => handleSave('credits')}
            >
              {t('patrol.save')}
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title={t('patrol.activity_title')}
          description={t('patrol.activity_description')}
          animateIn
        >
          <ToggleRow
            title={t('patrol.enabled')}
            description={t('patrol.activity_enabled_hint')}
            checked={activityDraft.enabled}
            disabled={disableControls}
            onChange={(enabled) => handleToggle('activity', enabled)}
          />
          <div className={FIELDS_ROOT_CLASS}>
            <FieldGrid>
              <Input
                label={t('patrol.interval')}
                hint={t('patrol.interval_hint')}
                value={activityDraft.interval}
                disabled={disableControls}
                onChange={(event) =>
                  setActivityDraft((prev) => ({ ...prev, interval: event.target.value }))
                }
              />
              <Input
                label={t('patrol.min_account_interval')}
                hint={t('patrol.min_account_interval_hint')}
                value={activityDraft.minAccountInterval}
                disabled={disableControls}
                onChange={(event) =>
                  setActivityDraft((prev) => ({
                    ...prev,
                    minAccountInterval: event.target.value,
                  }))
                }
              />
              <Input
                label={t('patrol.model')}
                hint={t('patrol.model_hint')}
                value={activityDraft.model}
                disabled={disableControls}
                onChange={(event) =>
                  setActivityDraft((prev) => ({ ...prev, model: event.target.value }))
                }
              />
            </FieldGrid>
          </div>
          <div className={styles.cardActions}>
            <Button
              size="sm"
              disabled={disableControls || !activityDirty}
              loading={savingKind === 'activity'}
              onClick={() => handleSave('activity')}
            >
              {t('patrol.save')}
            </Button>
          </div>
        </SectionCard>
      </div>

      <section className={styles.accounts}>
        <div className={styles.accountsHead}>
          <h2 className={styles.accountsTitle}>{t('patrol.accounts_title')}</h2>
          <ProviderTabs
            types={ACCOUNT_TABS}
            counts={tabCounts}
            active={tab}
            resolvedTheme={resolvedTheme}
            onChange={setTab}
          />
        </div>

        {loading && state.accounts.length === 0 ? (
          <Skeleton height={180} />
        ) : visibleAccounts.length === 0 ? (
          <EmptyState title={t('patrol.empty')} description={t('patrol.empty_desc')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('patrol.col_account')}</TableHead>
                <TableHead>{t('patrol.col_status')}</TableHead>
                <TableHead>{t('patrol.col_credits')}</TableHead>
                <TableHead>{t('patrol.col_activity')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleAccounts.map((account) => {
                const icon = getAuthFileIcon(account.provider, resolvedTheme);
                const exhausted = account.disabledReason === 'credits_exhausted';
                return (
                  <TableRow key={account.id || account.name}>
                    <TableCell>
                      <div className={styles.identity}>
                        {icon ? <img src={icon} alt="" className={styles.providerIcon} /> : null}
                        <div>
                          <div className={styles.email}>
                            {account.email || account.name}
                          </div>
                          <div className={styles.sub}>
                            {getTypeLabel(t, account.provider)}
                            {account.region
                              ? ` · ${t(`patrol.region_${account.region}`)}`
                              : ''}
                            {account.email ? ` · ${account.name}` : ''}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {account.disabled ? (
                        <span className={`${styles.pill} ${exhausted ? styles.warn : styles.bad}`}>
                          {exhausted
                            ? t('patrol.status_credits_exhausted')
                            : t('patrol.status_disabled')}
                        </span>
                      ) : (
                        <span className={`${styles.pill} ${styles.ok}`}>
                          {t('patrol.status_enabled')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{renderLast(account, 'credits')}</TableCell>
                    <TableCell>{renderLast(account, 'activity')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useRevealGroup } from '@/hooks/motion';
import { useNow } from '@/hooks/useNow';
import { buddyPatrolApi } from '@/services/api/buddyPatrol';
import { useAuthStore, useNotificationStore, useThemeStore } from '@/stores';
import { getErrorMessage } from '@/utils/helpers';
import { PatrolAccountsTable } from './components/PatrolAccountsTable';
import { PatrolTaskPanel } from './components/PatrolTaskPanel';
import {
  defaultActivitySettings,
  defaultCreditsSettings,
  defaultWebDailySettings,
  isValidGoDuration,
  mergeDraftAfterReload,
  toPatrolPatchBody,
} from './logic';
import type { BuddyPatrolState, PatrolKind, PatrolSettings } from './types';
import styles from './PatrolPage.module.scss';

const emptyState = (): BuddyPatrolState => ({
  homeMode: false,
  credits: defaultCreditsSettings(),
  activity: defaultActivitySettings(),
  webDaily: defaultWebDailySettings(),
  accounts: [],
});

const emptyDrafts = (): Record<PatrolKind, PatrolSettings> => ({
  credits: defaultCreditsSettings(),
  activity: defaultActivitySettings(),
  webDaily: defaultWebDailySettings(),
});

const KINDS: readonly PatrolKind[] = ['credits', 'activity', 'webDaily'];

export function PatrolPage() {
  const { t, i18n } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const showNotification = useNotificationStore((state) => state.showNotification);
  const revealRef = useRevealGroup<HTMLDivElement>();
  const now = useNow();

  const [state, setState] = useState<BuddyPatrolState>(emptyState);
  const [drafts, setDrafts] = useState<Record<PatrolKind, PatrolSettings>>(emptyDrafts);
  const savedRef = useRef(state);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingKind, setSavingKind] = useState<PatrolKind | null>(null);

  const disableControls = connectionStatus !== 'connected' || savingKind !== null;

  const applyState = useCallback(
    (
      next: BuddyPatrolState,
      savedKind?: PatrolKind,
      savedFields?: readonly (keyof PatrolSettings)[]
    ) => {
      const prev = savedRef.current;
      savedRef.current = next;
      setState(next);
      setDrafts((current) => {
        const merged = { ...current };
        KINDS.forEach((kind) => {
          merged[kind] = mergeDraftAfterReload(
            current[kind],
            prev[kind],
            next[kind],
            kind === savedKind ? savedFields : []
          );
        });
        return merged;
      });
    },
    []
  );

  const load = useCallback(async () => {
    setError('');
    try {
      applyState(await buddyPatrolApi.get());
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
    async (
      kind: PatrolKind,
      body: Record<string, unknown>,
      savedFields: readonly (keyof PatrolSettings)[]
    ) => {
      setSavingKind(kind);
      try {
        await buddyPatrolApi.patch(body);
        applyState(await buddyPatrolApi.get(), kind, savedFields);
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
    (kind: PatrolKind, enabled: boolean) => {
      void patchAndReload(kind, toPatrolPatchBody(kind, { enabled }), ['enabled']);
    },
    [patchAndReload]
  );

  const handleSave = useCallback(
    (kind: PatrolKind) => {
      const draft = drafts[kind];
      if (!isValidGoDuration(draft.interval) || !isValidGoDuration(draft.minAccountInterval)) {
        showNotification(t('patrol.invalid_duration'), 'error');
        return;
      }
      if (kind !== 'credits' && !draft.model.trim()) {
        showNotification(
          t(kind === 'webDaily' ? 'patrol.invalid_web_daily_model' : 'patrol.invalid_model'),
          'error'
        );
        return;
      }
      const savedFields: (keyof PatrolSettings)[] = ['interval', 'minAccountInterval'];
      if (kind !== 'credits') savedFields.push('model');
      void patchAndReload(
        kind,
        toPatrolPatchBody(kind, {
          interval: draft.interval,
          minAccountInterval: draft.minAccountInterval,
          ...(kind === 'credits' ? {} : { model: draft.model }),
        }),
        savedFields
      );
    },
    [drafts, patchAndReload, showNotification, t]
  );

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

      <PatrolTaskPanel
        state={state}
        drafts={drafts}
        savingKind={savingKind}
        disableControls={disableControls}
        onToggle={handleToggle}
        onChange={(kind, patch) =>
          setDrafts((current) => ({ ...current, [kind]: { ...current[kind], ...patch } }))
        }
        onRevert={(kind) => setDrafts((current) => ({ ...current, [kind]: state[kind] }))}
        onSave={handleSave}
      />

      <PatrolAccountsTable
        accounts={state.accounts}
        loading={loading}
        resolvedTheme={resolvedTheme}
        now={now}
        locale={i18n.resolvedLanguage}
      />
    </div>
  );
}

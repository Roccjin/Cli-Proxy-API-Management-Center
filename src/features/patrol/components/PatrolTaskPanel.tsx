import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import {
  isValidGoDuration,
  isValidMinRemain,
  settingsDirty,
  summarizePatrolTask,
  type PatrolTaskSummary,
} from '@/features/patrol/logic';
import type { BuddyPatrolState, PatrolKind, PatrolSettings } from '@/features/patrol/types';
import styles from './PatrolTaskPanel.module.scss';

type PatrolTaskPanelProps = {
  state: BuddyPatrolState;
  drafts: Record<PatrolKind, PatrolSettings>;
  savingKind: PatrolKind | null;
  disableControls: boolean;
  onToggle: (kind: PatrolKind, enabled: boolean) => void;
  onChange: (kind: PatrolKind, patch: Partial<PatrolSettings>) => void;
  onRevert: (kind: PatrolKind) => void;
  onSave: (kind: PatrolKind) => void;
};

const KINDS: readonly PatrolKind[] = ['credits', 'activity', 'webDaily'];

const withModel = (kind: PatrolKind) => kind !== 'credits';

export function PatrolTaskPanel({
  state,
  drafts,
  savingKind,
  disableControls,
  onToggle,
  onChange,
  onRevert,
  onSave,
}: PatrolTaskPanelProps) {
  const { t } = useTranslation();

  return (
    <section>
      <h2 className={styles.tasksTitle}>{t('patrol.tasks_title')}</h2>
      <div className={styles.panel}>
        {KINDS.map((kind) => (
          <TaskRow
            key={kind}
            kind={kind}
            draft={drafts[kind]}
            saved={state[kind]}
            summary={summarizePatrolTask(kind, state.accounts)}
            saving={savingKind === kind}
            disableControls={disableControls}
            onToggle={onToggle}
            onChange={onChange}
            onRevert={onRevert}
            onSave={onSave}
          />
        ))}
      </div>
      <datalist id="patrol-interval-presets">
        <option value="6h" />
        <option value="12h" />
        <option value="24h" />
        <option value="48h" />
      </datalist>
      <datalist id="patrol-account-interval-presets">
        <option value="30s" />
        <option value="45s" />
        <option value="60s" />
        <option value="2m" />
      </datalist>
    </section>
  );
}

function TaskRow({
  kind,
  draft,
  saved,
  summary,
  saving,
  disableControls,
  onToggle,
  onChange,
  onRevert,
  onSave,
}: {
  kind: PatrolKind;
  draft: PatrolSettings;
  saved: PatrolSettings;
  summary: PatrolTaskSummary;
  saving: boolean;
  disableControls: boolean;
  onToggle: (kind: PatrolKind, enabled: boolean) => void;
  onChange: (kind: PatrolKind, patch: Partial<PatrolSettings>) => void;
  onRevert: (kind: PatrolKind) => void;
  onSave: (kind: PatrolKind) => void;
}) {
  const { t } = useTranslation();
  const modelField = withModel(kind);
  const dirty = settingsDirty(draft, saved, modelField, kind === 'credits');
  const intervalInvalid = !isValidGoDuration(draft.interval);
  const accountIntervalInvalid = !isValidGoDuration(draft.minAccountInterval);
  const minRemainInvalid = kind === 'credits' && !isValidMinRemain(draft.minRemain);
  const modelInvalid = modelField && !draft.model.trim();
  const invalid = intervalInvalid || accountIntervalInvalid || modelInvalid || minRemainInvalid;
  const invalidTitle =
    intervalInvalid || accountIntervalInvalid
      ? t('patrol.invalid_duration')
      : minRemainInvalid
        ? t('patrol.invalid_min_remain')
        : t(kind === 'webDaily' ? 'patrol.invalid_web_daily_model' : 'patrol.invalid_model');
  const title =
    kind === 'credits'
      ? t('patrol.credits_title')
      : kind === 'activity'
        ? t('patrol.activity_title')
        : t('patrol.web_daily_title');
  const description =
    kind === 'credits'
      ? t('patrol.credits_description')
      : kind === 'activity'
        ? t('patrol.activity_description')
        : t('patrol.web_daily_description');
  const enabledHint =
    kind === 'credits'
      ? t('patrol.credits_enabled_hint')
      : kind === 'activity'
        ? t('patrol.activity_enabled_hint')
        : t('patrol.web_daily_enabled_hint');
  const scope =
    kind === 'credits'
      ? t('patrol.scope_credits')
      : kind === 'activity'
        ? t('patrol.scope_activity')
        : t('patrol.scope_web_daily');
  const intervalPlaceholder = kind === 'credits' ? '12h' : '24h';

  return (
    <div className={styles.taskRow}>
      <div className={styles.taskCopy}>
        <div className={styles.taskHeading}>
          <h3 className={styles.taskName}>{title}</h3>
          <span className={styles.scope}>{scope}</span>
        </div>
        <p className={styles.description} title={description}>
          {description}
        </p>
        <TaskStats summary={summary} />
      </div>
      <div title={enabledHint}>
        <ToggleSwitch
          checked={draft.enabled}
          ariaLabel={title}
          disabled={disableControls}
          onChange={(enabled) => onToggle(kind, enabled)}
        />
      </div>
      <div className={styles.taskFields}>
        <Input
          label={t('patrol.interval')}
          title={t('patrol.interval_hint')}
          placeholder={intervalPlaceholder}
          list="patrol-interval-presets"
          value={draft.interval}
          disabled={disableControls}
          className={intervalInvalid ? styles.inputInvalid : undefined}
          aria-invalid={intervalInvalid || undefined}
          onChange={(event) => onChange(kind, { interval: event.target.value })}
        />
        <Input
          label={t('patrol.min_account_interval')}
          title={t('patrol.min_account_interval_hint')}
          placeholder="45s"
          list="patrol-account-interval-presets"
          value={draft.minAccountInterval}
          disabled={disableControls}
          className={accountIntervalInvalid ? styles.inputInvalid : undefined}
          aria-invalid={accountIntervalInvalid || undefined}
          onChange={(event) => onChange(kind, { minAccountInterval: event.target.value })}
        />
        <div className={styles.taskModel}>
          {kind === 'credits' ? (
            <Input
              label={t('patrol.min_remain')}
              title={t('patrol.min_remain_hint')}
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={Number.isFinite(draft.minRemain) ? String(draft.minRemain) : ''}
              disabled={disableControls}
              className={minRemainInvalid ? styles.inputInvalid : undefined}
              aria-invalid={minRemainInvalid || undefined}
              onChange={(event) => {
                const raw = event.target.value.trim();
                onChange(kind, { minRemain: raw === '' ? Number.NaN : Number(raw) });
              }}
            />
          ) : (
            <Input
              label={t('patrol.model')}
              title={t(kind === 'webDaily' ? 'patrol.web_daily_model_hint' : 'patrol.model_hint')}
              placeholder="deepseek-v4.1-flash"
              value={draft.model}
              disabled={disableControls}
              className={modelInvalid ? styles.inputInvalid : undefined}
              aria-invalid={modelInvalid || undefined}
              onChange={(event) => onChange(kind, { model: event.target.value })}
            />
          )}
        </div>
        <div className={`${styles.taskActions} ${dirty ? '' : styles.actionsIdle}`}>
          <Button
            variant="ghost"
            size="sm"
            disabled={disableControls}
            onClick={() => onRevert(kind)}
          >
            {t('patrol.revert')}
          </Button>
          <Button
            size="sm"
            title={invalid ? invalidTitle : undefined}
            disabled={disableControls || !dirty || invalid}
            loading={saving}
            onClick={() => onSave(kind)}
          >
            {t('patrol.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaskStats({ summary }: { summary: PatrolTaskSummary }) {
  const { t } = useTranslation();
  const parts: { key: string; text: string; className?: string }[] = [
    { key: 'relevant', text: t('patrol.stat_relevant', { count: summary.relevant }) },
  ];
  if (summary.ok > 0) {
    parts.push({
      key: 'ok',
      text: t('patrol.stat_ok', { count: summary.ok }),
      className: styles.statOk,
    });
  }
  if (summary.warn > 0) {
    parts.push({
      key: 'warn',
      text: t('patrol.stat_warn', { count: summary.warn }),
      className: styles.statWarn,
    });
  }
  if (summary.bad > 0) {
    parts.push({
      key: 'bad',
      text: t('patrol.stat_bad', { count: summary.bad }),
      className: styles.statBad,
    });
  }
  if (summary.never > 0) {
    parts.push({
      key: 'never',
      text: t('patrol.stat_never', { count: summary.never }),
      className: styles.statNever,
    });
  }
  return (
    <div className={styles.stats}>
      {parts.map((part, index) => (
        <span key={part.key} className={part.className}>
          {index > 0 ? ' · ' : ''}
          {part.text}
        </span>
      ))}
    </div>
  );
}

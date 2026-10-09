import { isRecord } from '@/utils/helpers';
import type {
  BuddyPatrolState,
  PatrolAccount,
  PatrolKind,
  PatrolLastResult,
  PatrolSettings,
  PatrolSettingsPatch,
} from './types';

/** Go time.ParseDuration units, including concatenated values like 1h30m. */
export const GO_DURATION_PATTERN = /^(?:\d+(?:\.\d+)?(?:ns|us|µs|μs|ms|s|m|h))+$/;

export const isValidGoDuration = (value: string): boolean =>
  GO_DURATION_PATTERN.test(value.trim());

/** 最低剩余积分：0 表示关闭提前停用，负数和空值无效。 */
export const isValidMinRemain = (value: number): boolean => Number.isFinite(value) && value >= 0;

export const defaultCreditsSettings = (): PatrolSettings => ({
  enabled: true,
  interval: '12h',
  startupJitter: '10m',
  minAccountInterval: '45s',
  accountJitter: '30s',
  minRemain: 1,
  requestTimeout: '45s',
  model: '',
});

export const defaultActivitySettings = (): PatrolSettings => ({
  enabled: true,
  interval: '24h',
  startupJitter: '10m',
  minAccountInterval: '45s',
  accountJitter: '30s',
  minRemain: 0,
  requestTimeout: '180s',
  model: 'deepseek-v4.1-flash',
});

export const defaultWebDailySettings = (): PatrolSettings => ({
  enabled: true,
  interval: '24h',
  startupJitter: '10m',
  minAccountInterval: '45s',
  accountJitter: '30s',
  minRemain: 0,
  requestTimeout: '180s',
  model: 'deepseek-v4.1-flash',
});

const readString = (source: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const readBoolean = (source: Record<string, unknown>, ...keys: string[]): boolean | undefined => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'boolean') return value;
  }
  return undefined;
};

const readNumber = (source: Record<string, unknown>, ...keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const normalizeSettings = (
  raw: unknown,
  fallback: PatrolSettings,
  includeModel: boolean
): PatrolSettings => {
  const source = isRecord(raw) ? raw : {};
  const interval = readString(source, 'interval') || fallback.interval;
  const minAccountInterval =
    readString(source, 'min-account-interval', 'minAccountInterval') || fallback.minAccountInterval;
  const model = includeModel
    ? readString(source, 'model') || fallback.model
    : '';
  return {
    enabled: readBoolean(source, 'enabled') ?? fallback.enabled,
    interval,
    startupJitter:
      readString(source, 'startup-jitter', 'startupJitter') || fallback.startupJitter,
    minAccountInterval,
    accountJitter: readString(source, 'account-jitter', 'accountJitter') || fallback.accountJitter,
    minRemain: readNumber(source, 'min-remain', 'minRemain') ?? fallback.minRemain,
    requestTimeout:
      readString(source, 'request-timeout', 'requestTimeout') || fallback.requestTimeout,
    model,
  };
};

const normalizeLastResult = (raw: unknown): PatrolLastResult | undefined => {
  if (!isRecord(raw)) return undefined;
  const at = readString(raw, 'at');
  const result = readString(raw, 'result');
  const remain = readNumber(raw, 'remain');
  if (!at && !result && remain === undefined) return undefined;
  return {
    at,
    result,
    ...(remain === undefined ? {} : { remain }),
  };
};

const normalizeAccount = (raw: unknown): PatrolAccount | null => {
  if (!isRecord(raw)) return null;
  const provider = readString(raw, 'provider', 'type').toLowerCase();
  if (provider !== 'codebuddy' && provider !== 'workbuddy') return null;
  const name = readString(raw, 'name', 'id');
  if (!name) return null;
  return {
    id: readString(raw, 'id') || name,
    name,
    email: readString(raw, 'email'),
    provider,
    disabled: readBoolean(raw, 'disabled') === true,
    disabledReason: readString(raw, 'disabled_reason', 'disabledReason'),
    region: readString(raw, 'region') || 'cn',
    activityEligible: readBoolean(raw, 'activity_eligible', 'activityEligible') === true,
    webDailyEligible: readBoolean(raw, 'web_daily_eligible', 'webDailyEligible') === true,
    credits: normalizeLastResult(raw.credits),
    activity: normalizeLastResult(raw.activity),
    webDaily: normalizeLastResult(raw.web_daily ?? raw.webDaily),
  };
};

export const normalizeBuddyPatrol = (payload: unknown): BuddyPatrolState => {
  const source = isRecord(payload) ? payload : {};
  const accountsRaw = Array.isArray(source.accounts) ? source.accounts : [];
  return {
    homeMode: readBoolean(source, 'home-mode', 'homeMode') === true,
    credits: normalizeSettings(source.credits, defaultCreditsSettings(), false),
    activity: normalizeSettings(source.activity, defaultActivitySettings(), true),
    webDaily: normalizeSettings(
      source['web-daily'] ?? source.webDaily,
      defaultWebDailySettings(),
      true
    ),
    accounts: accountsRaw
      .map(normalizeAccount)
      .filter((account): account is PatrolAccount => account !== null),
  };
};

const patrolPatchKey = (kind: PatrolKind): string => (kind === 'webDaily' ? 'web-daily' : kind);

export const toPatrolPatchBody = (
  kind: PatrolKind,
  patch: PatrolSettingsPatch
): Record<string, Record<string, unknown>> => {
  const body: Record<string, unknown> = {};
  if (patch.enabled !== undefined) body.enabled = patch.enabled;
  if (patch.interval !== undefined) body.interval = patch.interval.trim();
  if (patch.minAccountInterval !== undefined) {
    body['min-account-interval'] = patch.minAccountInterval.trim();
  }
  if (patch.minRemain !== undefined) body['min-remain'] = patch.minRemain;
  if (patch.model !== undefined) body.model = patch.model.trim();
  return { [patrolPatchKey(kind)]: body };
};

const sameMinRemain = (left: number, right: number): boolean =>
  Number.isFinite(left) && Number.isFinite(right) ? left === right : !Number.isFinite(left) && !Number.isFinite(right);

export const settingsDirty = (
  draft: PatrolSettings,
  saved: PatrolSettings,
  withModel: boolean,
  withMinRemain = false
) =>
  draft.interval.trim() !== saved.interval.trim() ||
  draft.minAccountInterval.trim() !== saved.minAccountInterval.trim() ||
  (withModel && draft.model.trim() !== saved.model.trim()) ||
  (withMinRemain && !sameMinRemain(draft.minRemain, saved.minRemain));

export const patrolResultTone = (
  result: string | undefined
): 'ok' | 'warn' | 'bad' | 'muted' => {
  switch (result) {
    case 'ok':
    case 'reenabled':
      return 'ok';
    case 'still_empty':
    case 'credits_exhausted':
      return 'warn';
    case 'auth_invalid':
    case 'failed':
      return 'bad';
    default:
      return 'muted';
  }
};

export const accountIdentity = (account: PatrolAccount): string =>
  account.email || account.name;

/** Keep unsaved edits. Fields the server just accepted follow the reloaded value. */
export function mergeDraftAfterReload(
  draft: PatrolSettings,
  prevSaved: PatrolSettings,
  nextSaved: PatrolSettings,
  savedFields?: readonly (keyof PatrolSettings)[]
): PatrolSettings {
  const accepted = new Set(savedFields ?? []);
  const pick = <K extends keyof PatrolSettings>(key: K): PatrolSettings[K] => {
    if (accepted.has(key) || draft[key] === prevSaved[key]) return nextSaved[key];
    return draft[key];
  };
  return {
    enabled: pick('enabled'),
    interval: pick('interval'),
    startupJitter: pick('startupJitter'),
    minAccountInterval: pick('minAccountInterval'),
    accountJitter: pick('accountJitter'),
    minRemain: pick('minRemain'),
    requestTimeout: pick('requestTimeout'),
    model: pick('model'),
  };
}

export type PatrolAccountFilter = 'all' | 'attention' | 'disabled' | 'pending';
export const PATROL_ACCOUNT_FILTERS: readonly PatrolAccountFilter[] = [
  'all',
  'attention',
  'disabled',
  'pending',
];
export const PATROL_PAGE_SIZES = [20, 50, 100] as const;
export const DEFAULT_PATROL_PAGE_SIZE = 20;

export const isCreditsPatrolTarget = (account: PatrolAccount): boolean =>
  account.disabled &&
  (account.disabledReason === 'credits_exhausted' ||
    account.disabledReason === 'credits_reserve');

export const patrolLastResult = (
  account: PatrolAccount,
  kind: PatrolKind
): PatrolLastResult | undefined =>
  kind === 'credits' ? account.credits : kind === 'activity' ? account.activity : account.webDaily;

export const applicablePatrolKinds = (account: PatrolAccount): PatrolKind[] => {
  const kinds: PatrolKind[] = [];
  if (isCreditsPatrolTarget(account) || account.credits) kinds.push('credits');
  if (account.activityEligible) kinds.push('activity');
  if (account.webDailyEligible) kinds.push('webDaily');
  return kinds;
};

export type PatrolTaskSummary = {
  relevant: number;
  ok: number;
  warn: number;
  bad: number;
  never: number;
};

export const summarizePatrolTask = (
  kind: PatrolKind,
  accounts: readonly PatrolAccount[]
): PatrolTaskSummary => {
  const summary: PatrolTaskSummary = { relevant: 0, ok: 0, warn: 0, bad: 0, never: 0 };
  accounts.forEach((account) => {
    if (!applicablePatrolKinds(account).includes(kind)) return;
    summary.relevant += 1;
    const result = patrolLastResult(account, kind)?.result;
    if (!result) {
      summary.never += 1;
      return;
    }
    const tone = patrolResultTone(result);
    if (tone === 'ok' || tone === 'warn' || tone === 'bad') summary[tone] += 1;
  });
  return summary;
};

export const patrolAccountNeedsAttention = (account: PatrolAccount): boolean =>
  account.disabled ||
  applicablePatrolKinds(account).some((kind) => {
    const tone = patrolResultTone(patrolLastResult(account, kind)?.result);
    return tone === 'warn' || tone === 'bad';
  });

export const patrolAccountPending = (account: PatrolAccount): boolean =>
  applicablePatrolKinds(account).some((kind) => !patrolLastResult(account, kind)?.result);

export const filterPatrolAccounts = (
  accounts: readonly PatrolAccount[],
  options: { provider: string; query: string; filter: PatrolAccountFilter }
): PatrolAccount[] => {
  const query = options.query.trim().toLowerCase();
  return accounts.filter((account) => {
    if (options.provider !== 'all' && account.provider !== options.provider) return false;
    if (query) {
      const email = account.email.toLowerCase();
      const name = account.name.toLowerCase();
      if (!email.includes(query) && !name.includes(query)) return false;
    }
    if (options.filter === 'attention') return patrolAccountNeedsAttention(account);
    if (options.filter === 'disabled') return account.disabled;
    if (options.filter === 'pending') return patrolAccountPending(account);
    return true;
  });
};

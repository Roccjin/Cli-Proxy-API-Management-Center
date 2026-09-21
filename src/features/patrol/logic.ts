import { isRecord } from '@/utils/helpers';
import type {
  BuddyPatrolState,
  PatrolAccount,
  PatrolLastResult,
  PatrolSettings,
  PatrolSettingsPatch,
} from './types';

/** Go time.ParseDuration units, including concatenated values like 1h30m. */
export const GO_DURATION_PATTERN = /^(?:\d+(?:\.\d+)?(?:ns|us|µs|μs|ms|s|m|h))+$/;

export const isValidGoDuration = (value: string): boolean =>
  GO_DURATION_PATTERN.test(value.trim());

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
    credits: normalizeLastResult(raw.credits),
    activity: normalizeLastResult(raw.activity),
  };
};

export const normalizeBuddyPatrol = (payload: unknown): BuddyPatrolState => {
  const source = isRecord(payload) ? payload : {};
  const accountsRaw = Array.isArray(source.accounts) ? source.accounts : [];
  return {
    homeMode: readBoolean(source, 'home-mode', 'homeMode') === true,
    credits: normalizeSettings(source.credits, defaultCreditsSettings(), false),
    activity: normalizeSettings(source.activity, defaultActivitySettings(), true),
    accounts: accountsRaw
      .map(normalizeAccount)
      .filter((account): account is PatrolAccount => account !== null),
  };
};

export const toPatrolPatchBody = (
  kind: 'credits' | 'activity',
  patch: PatrolSettingsPatch
): Record<string, Record<string, unknown>> => {
  const body: Record<string, unknown> = {};
  if (patch.enabled !== undefined) body.enabled = patch.enabled;
  if (patch.interval !== undefined) body.interval = patch.interval.trim();
  if (patch.minAccountInterval !== undefined) {
    body['min-account-interval'] = patch.minAccountInterval.trim();
  }
  if (patch.model !== undefined) body.model = patch.model.trim();
  return { [kind]: body };
};

export const settingsDirty = (draft: PatrolSettings, saved: PatrolSettings, withModel: boolean) =>
  draft.interval.trim() !== saved.interval.trim() ||
  draft.minAccountInterval.trim() !== saved.minAccountInterval.trim() ||
  (withModel && draft.model.trim() !== saved.model.trim());

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

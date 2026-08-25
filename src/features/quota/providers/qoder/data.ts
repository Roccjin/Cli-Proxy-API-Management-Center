/** Qoder quota data: live /qoder-quota, with auth-file snapshot as fallback. */

import type { TFunction } from 'i18next';
import { apiClient } from '@/services/api/client';
import type { AuthFileItem, QoderQuotaState, QoderUsageSnapshot } from '@/types';
import { isRecord } from '@/utils/helpers';
import { getStatusFromError, isDisabledAuthFile, isQoderFile, normalizeNumberValue } from '@/utils/quota';
import type { QuotaProviderData } from '../types';

export type QoderQuotaBucketView = {
  used: number | null;
  total: number | null;
  remaining: number | null;
  remainingPercent: number | null;
  unit: string | null;
};

export const readQoderUsageSnapshot = (file: AuthFileItem): QoderUsageSnapshot | null => {
  const raw = file.usage;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as QoderUsageSnapshot;
};

const remainingPercentFromParts = (
  usedPct: number | null,
  used: number | null,
  total: number | null,
  remaining: number | null
): number | null => {
  if (usedPct !== null) {
    const usedPercent = usedPct <= 1 ? usedPct * 100 : usedPct;
    return 100 - Math.max(0, Math.min(100, usedPercent));
  }
  if (!total || total <= 0) return null;
  if (used !== null) return 100 - Math.max(0, Math.min(100, (used / total) * 100));
  if (remaining !== null) return Math.max(0, Math.min(100, (remaining / total) * 100));
  return null;
};

export const qoderRemainingPercent = (usage: QoderUsageSnapshot): number | null => {
  const user = readQoderUserBucket(usage);
  if (user) return user.remainingPercent;
  return remainingPercentFromParts(
    normalizeNumberValue(usage.percentage),
    normalizeNumberValue(usage.used),
    normalizeNumberValue(usage.total),
    normalizeNumberValue(usage.remaining)
  );
};

export const readQoderQuotaBucket = (raw: unknown): QoderQuotaBucketView | null => {
  if (!isRecord(raw)) return null;
  const used = normalizeNumberValue(raw.used);
  const total = normalizeNumberValue(raw.total);
  const remaining = normalizeNumberValue(raw.remaining);
  if (used === null && total === null && remaining === null) return null;
  if ((used ?? 0) === 0 && (total ?? 0) === 0 && (remaining ?? 0) === 0) return null;
  const unit = typeof raw.unit === 'string' && raw.unit.trim() ? raw.unit.trim() : null;
  return {
    used,
    total,
    remaining,
    remainingPercent: remainingPercentFromParts(
      normalizeNumberValue(raw.percentage),
      used,
      total,
      remaining
    ),
    unit,
  };
};

export const readQoderUserBucket = (usage: QoderUsageSnapshot): QoderQuotaBucketView | null => {
  return (
    readQoderQuotaBucket(usage.userQuota ?? usage.user_quota) ??
    readQoderQuotaBucket({
      used: usage.used,
      total: usage.total,
      remaining: usage.remaining,
      percentage: usage.percentage,
      unit: usage.unit,
    })
  );
};

export const readQoderOrgBucket = (usage: QoderUsageSnapshot): QoderQuotaBucketView | null => {
  const nested = readQoderQuotaBucket(usage.orgResourcePackage ?? usage.org_resource_package);
  if (nested) return nested;
  const remaining = normalizeNumberValue(usage.org_resource_remaining ?? usage.orgResourceRemaining);
  if (remaining === null) return null;
  return { used: null, total: null, remaining, remainingPercent: null, unit: null };
};

const readUsageFromPayload = (payload: unknown): QoderUsageSnapshot | null => {
  if (!isRecord(payload)) return null;
  if (isRecord(payload.usage)) return payload.usage as QoderUsageSnapshot;
  if (payload.used != null || payload.userQuota != null || payload.orgResourcePackage != null) {
    return payload as QoderUsageSnapshot;
  }
  return null;
};

const fetchQoderQuota = async (
  file: AuthFileItem,
  t: TFunction
): Promise<QoderUsageSnapshot> => {
  const name = String(file.name ?? '').trim();
  if (name) {
    try {
      const payload = await apiClient.get<unknown>('/qoder-quota', { params: { name } });
      const live = readUsageFromPayload(payload);
      if (live) return live;
    } catch (err: unknown) {
      if (getStatusFromError(err) !== 404) throw err;
    }
  }
  const usage = readQoderUsageSnapshot(file);
  if (!usage) throw new Error(t('qoder_quota.empty_data'));
  return usage;
};

export const QODER_CONFIG: QuotaProviderData<QoderQuotaState, QoderUsageSnapshot> = {
  type: 'qoder',
  i18nPrefix: 'qoder_quota',
  filterFn: (file) => isQoderFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchQoderQuota,
  storeSelector: (state) => state.qoderQuota,
  storeSetter: 'setQoderQuota',
  buildLoadingState: () => ({ status: 'loading', usage: null }),
  buildSuccessState: (usage) => ({ status: 'success', usage }),
  buildErrorState: (message, status) => ({
    status: 'error',
    usage: null,
    error: message,
    errorStatus: status,
  }),
};

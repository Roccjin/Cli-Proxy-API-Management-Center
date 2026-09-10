/** WorkBuddy credits: live /workbuddy-quota. */

import type { TFunction } from 'i18next';
import { apiClient } from '@/services/api/client';
import type { AuthFileItem, WorkBuddyQuotaSnapshot, WorkBuddyQuotaState } from '@/types';
import { isRecord } from '@/utils/helpers';
import { getStatusFromError, isWorkBuddyFile, isDisabledAuthFile, normalizeNumberValue } from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import { normalizeWorkBuddySite, type WorkBuddySite } from '@/utils/workbuddy';
import type { QuotaProviderData } from '../types';

export type WorkBuddyQuotaView = {
  site: WorkBuddySite;
  totalRemain: number;
  totalUsed: number;
  totalSize: number;
  packCount: number;
  remainingPercent: number | null;
  fetchedAt: string | null;
  packages: Array<{
    name: string;
    remain: number;
    used: number;
    size: number;
    remainingPercent: number | null;
    cycleEnd: string | null;
  }>;
};

const remainingPercent = (remain: number, size: number): number | null => {
  if (!size || size <= 0) return null;
  return Math.max(0, Math.min(100, (remain / size) * 100));
};

export const readWorkBuddyQuotaSnapshot = (payload: unknown): WorkBuddyQuotaSnapshot | null => {
  if (!isRecord(payload)) return null;
  if (isRecord(payload.usage)) return payload.usage as WorkBuddyQuotaSnapshot;
  if (payload.total_remain != null || payload.totalRemain != null || payload.packages != null) {
    return payload as WorkBuddyQuotaSnapshot;
  }
  return null;
};

export const readWorkBuddyQuotaView = (usage: WorkBuddyQuotaSnapshot | null): WorkBuddyQuotaView | null => {
  if (!usage) return null;
  const totalRemain = normalizeNumberValue(usage.total_remain ?? usage.totalRemain) ?? 0;
  const totalUsed = normalizeNumberValue(usage.total_used ?? usage.totalUsed) ?? 0;
  const totalSize = normalizeNumberValue(usage.total_size ?? usage.totalSize) ?? 0;
  const packCount = normalizeNumberValue(usage.pack_count ?? usage.packCount) ?? 0;
  const packages = Array.isArray(usage.packages) ? usage.packages : [];
  return {
    site: normalizeWorkBuddySite(usage.site),
    totalRemain,
    totalUsed,
    totalSize,
    packCount,
    remainingPercent: remainingPercent(totalRemain, totalSize),
    fetchedAt: typeof (usage.fetched_at ?? usage.fetchedAt) === 'string'
      ? String(usage.fetched_at ?? usage.fetchedAt)
      : null,
    packages: packages.map((pkg) => {
      const remain = normalizeNumberValue(pkg.remain) ?? 0;
      const used = normalizeNumberValue(pkg.used) ?? 0;
      const size = normalizeNumberValue(pkg.size) ?? 0;
      const cycleEnd = pkg.cycle_end ?? pkg.cycleEnd;
      return {
        name: typeof pkg.name === 'string' && pkg.name.trim() ? pkg.name.trim() : '',
        remain,
        used,
        size,
        remainingPercent: remainingPercent(remain, size),
        cycleEnd: typeof cycleEnd === 'string' && cycleEnd.trim() ? cycleEnd.trim() : null,
      };
    }),
  };
};

const fetchWorkBuddyQuota = async (
  file: AuthFileItem,
  t: TFunction
): Promise<WorkBuddyQuotaSnapshot> => {
  const name = String(file.name ?? '').trim();
  if (!name) {
    throw new Error(t('workbuddy_quota.empty_data'));
  }
  const params: Record<string, string> = { name };
  const authIndex = normalizeAuthIndex(file['auth_index'] ?? file.authIndex);
  if (authIndex) {
    params.auth_index = authIndex;
  }

  const requestOnce = async (): Promise<WorkBuddyQuotaSnapshot> => {
    const payload = await apiClient.get<unknown>('/workbuddy-quota', {
      params,
      timeout: 45_000,
    });
    const live = readWorkBuddyQuotaSnapshot(payload);
    if (!live) throw new Error(t('workbuddy_quota.empty_data'));
    return live;
  };

  try {
    return await requestOnce();
  } catch (err: unknown) {
    const status = getStatusFromError(err);
    if (status !== undefined && status < 500 && status !== 408) {
      throw err;
    }
    return requestOnce();
  }
};

export const WORKBUDDY_CONFIG: QuotaProviderData<WorkBuddyQuotaState, WorkBuddyQuotaSnapshot> = {
  type: 'workbuddy',
  i18nPrefix: 'workbuddy_quota',
  filterFn: (file) => isWorkBuddyFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchWorkBuddyQuota,
  storeSelector: (state) => state.workbuddyQuota,
  storeSetter: 'setWorkBuddyQuota',
  buildLoadingState: () => ({ status: 'loading', usage: null }),
  buildSuccessState: (usage) => ({ status: 'success', usage }),
  buildErrorState: (message, status) => ({
    status: 'error',
    usage: null,
    error: message,
    errorStatus: status,
  }),
};

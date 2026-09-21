import { apiClient } from './client';
import { normalizeBuddyPatrol } from '@/features/patrol/logic';
import type { BuddyPatrolState } from '@/features/patrol/types';

const ENDPOINT = '/buddy-patrol';

export const buddyPatrolApi = {
  get: async (): Promise<BuddyPatrolState> =>
    normalizeBuddyPatrol(await apiClient.get<unknown>(ENDPOINT)),

  patch: (body: Record<string, unknown>) => apiClient.patch(ENDPOINT, body),
};

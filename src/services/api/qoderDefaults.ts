import { apiClient } from './client';
import { isRecord } from '@/utils/helpers';

export type QoderModelDefault = {
  thinking?: string;
  context?: string;
};

const ENDPOINT = '/qoder-model-defaults';

export const normalizeQoderModelDefaults = (
  payload: unknown
): Record<string, QoderModelDefault> => {
  if (!isRecord(payload)) return {};
  const source = isRecord(payload['qoder-model-defaults'])
    ? payload['qoder-model-defaults']
    : payload;
  const out: Record<string, QoderModelDefault> = {};
  Object.entries(source).forEach(([key, value]) => {
    const model = String(key || '').trim().replace(/^qoder\//i, '');
    if (!model || !isRecord(value)) return;
    const thinking = typeof value.thinking === 'string' ? value.thinking.trim() : '';
    const context = typeof value.context === 'string' ? value.context.trim() : '';
    if (!thinking && !context) return;
    out[model] = {
      ...(thinking ? { thinking } : {}),
      ...(context ? { context } : {}),
    };
  });
  return out;
};

export const qoderDefaultsApi = {
  get: async () =>
    normalizeQoderModelDefaults(await apiClient.get<unknown>(ENDPOINT)),

  put: (defaults: Record<string, QoderModelDefault>) =>
    apiClient.put(ENDPOINT, { 'qoder-model-defaults': defaults }),
};

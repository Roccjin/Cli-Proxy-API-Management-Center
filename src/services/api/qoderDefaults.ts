import { apiClient } from './client';
import { isRecord } from '@/utils/helpers';
import type { ModelInfo } from '@/utils/models';

export type QoderModelDefault = {
  thinking?: string;
  context?: string;
};

export type QoderCatalogModel = {
  key: string;
  displayName: string;
  thinkingLevels: string[];
  zeroAllowed: boolean;
  contextSizes: string[];
  catalogContext: string;
};

export const QODER_CONTEXT_SIZES = ['200K', '400K', '1M'] as const;

export const QODER_THINKING_LEVELS = ['low', 'medium', 'high', 'max', 'xhigh'] as const;

export const FALLBACK_QODER_MODEL_KEYS = [
  'auto',
  'ultimate',
  'performance',
  'efficient',
  'lite',
  'qmodel',
  'qmodel_latest',
  'dmodel',
  'dfmodel',
  'gm51model',
  'kmodel',
  'mmodel',
] as const;

export const fallbackQoderCatalog = (): QoderCatalogModel[] =>
  FALLBACK_QODER_MODEL_KEYS.map((key) => ({
    key,
    displayName: key,
    thinkingLevels: [...QODER_THINKING_LEVELS],
    zeroAllowed: true,
    contextSizes: [...QODER_CONTEXT_SIZES],
    catalogContext: '',
  }));

const DEFAULTS_ENDPOINT = '/qoder-model-defaults';
const MODELS_ENDPOINT = '/qoder-models';

const upstreamKey = (id: string) => id.replace(/^qoder\//i, '').trim();

export const normalizeContextLabel = (raw: string): string => {
  const value = String(raw || '').trim();
  switch (value.toUpperCase()) {
    case '200K':
    case '200000':
      return '200K';
    case '400K':
    case '400000':
      return '400K';
    case '1M':
    case '1000000':
      return '1M';
    default:
      return value;
  }
};

export const extractContextSizes = (cfg: unknown): string[] => {
  const found = new Set<string>(QODER_CONTEXT_SIZES);
  if (isRecord(cfg)) {
    Object.keys(cfg).forEach((key) => {
      const label = normalizeContextLabel(key);
      if (label) found.add(label);
    });
  }
  const extras = [...found].filter(
    (size) => !QODER_CONTEXT_SIZES.includes(size as (typeof QODER_CONTEXT_SIZES)[number])
  );
  extras.sort();
  return [...QODER_CONTEXT_SIZES, ...extras];
};

export const extractCatalogDefault = (cfg: unknown): string => {
  if (!isRecord(cfg)) return '';
  for (const [key, value] of Object.entries(cfg)) {
    if (isRecord(value) && value.is_default === true) {
      return normalizeContextLabel(key);
    }
  }
  return '';
};

export const normalizeQoderModelDefaults = (
  payload: unknown
): Record<string, QoderModelDefault> => {
  if (!isRecord(payload)) return {};
  const source = isRecord(payload['qoder-model-defaults'])
    ? payload['qoder-model-defaults']
    : payload;
  const out: Record<string, QoderModelDefault> = {};
  Object.entries(source).forEach(([key, value]) => {
    const model = upstreamKey(String(key || ''));
    if (!model || !isRecord(value)) return;
    const thinking = typeof value.thinking === 'string' ? value.thinking.trim() : '';
    const context = normalizeContextLabel(
      typeof value.context === 'string' ? value.context : ''
    );
    if (!thinking && !context) return;
    out[model] = {
      ...(thinking ? { thinking } : {}),
      ...(context ? { context } : {}),
    };
  });
  return out;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map((item) => item.trim());
};

export const normalizeQoderCatalog = (payload: unknown): QoderCatalogModel[] => {
  if (!isRecord(payload) || !Array.isArray(payload.models)) return [];
  const out: QoderCatalogModel[] = [];
  const seen = new Set<string>();
  payload.models.forEach((entry) => {
    if (!isRecord(entry)) return;
    const key = upstreamKey(String(entry.key || entry.id || entry.name || ''));
    if (!key || seen.has(key)) return;
    seen.add(key);
    const displayName =
      typeof entry.display_name === 'string' && entry.display_name.trim()
        ? entry.display_name.trim()
        : key;
    const thinkingLevels = asStringArray(entry.thinking_levels);
    const contextSizes = extractContextSizes(
      Array.isArray(entry.context_sizes)
        ? Object.fromEntries(asStringArray(entry.context_sizes).map((size) => [size, {}]))
        : entry.context_config
    );
    const catalogContext =
      typeof entry.catalog_context === 'string'
        ? normalizeContextLabel(entry.catalog_context)
        : extractCatalogDefault(entry.context_config);
    out.push({
      key,
      displayName,
      thinkingLevels,
      zeroAllowed: entry.zero_allowed === true,
      contextSizes: contextSizes.length ? contextSizes : [...QODER_CONTEXT_SIZES],
      catalogContext,
    });
  });
  return out;
};

export const catalogFromV1Models = (models: ModelInfo[]): QoderCatalogModel[] => {
  const out: QoderCatalogModel[] = [];
  const seen = new Set<string>();
  models.forEach((model) => {
    const type = (model.type || '').toLowerCase();
    const isQoder =
      type === 'qoder' || /^qoder\//i.test(model.name) || /qoder/i.test(model.alias || '');
    if (!isQoder) return;
    const key = upstreamKey(model.name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const thinking = isRecord(model.thinking) ? model.thinking : {};
    const levels = Array.isArray(thinking.levels)
      ? thinking.levels.filter((level): level is string => typeof level === 'string' && level.trim() !== '')
      : [];
    out.push({
      key,
      displayName: model.alias || model.name,
      thinkingLevels: levels.map((level) => level.trim()),
      zeroAllowed: thinking.zero_allowed === true,
      contextSizes: extractContextSizes(model.contextConfig),
      catalogContext: extractCatalogDefault(model.contextConfig),
    });
  });
  return out;
};

export const mergeCatalogWithDefaults = (
  catalog: QoderCatalogModel[],
  defaults: Record<string, QoderModelDefault>
): QoderCatalogModel[] => {
  const out = [...catalog];
  const seen = new Set(catalog.map((row) => row.key));
  Object.keys(defaults).forEach((key) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({
      key,
      displayName: key,
      thinkingLevels: [],
      zeroAllowed: true,
      contextSizes: [...QODER_CONTEXT_SIZES],
      catalogContext: '',
    });
  });
  return out;
};

export const qoderDefaultsApi = {
  get: async () =>
    normalizeQoderModelDefaults(await apiClient.get<unknown>(DEFAULTS_ENDPOINT)),

  put: (defaults: Record<string, QoderModelDefault>) =>
    apiClient.put(DEFAULTS_ENDPOINT, { 'qoder-model-defaults': defaults }),

  listModels: async () =>
    normalizeQoderCatalog(await apiClient.get<unknown>(MODELS_ENDPOINT)),
};

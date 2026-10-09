import {
  QODER_CONTEXT_SIZES,
  QODER_THINKING_LEVELS,
  type QoderCatalogModel,
  type QoderModelDefault,
} from '@/services/api/qoderDefaults';

export type QoderDefaults = Record<string, QoderModelDefault>;
export type QoderField = 'thinking' | 'context';
export const QODER_INHERIT = '__inherit__';

/** Copy-on-write. An empty value drops the field, and an empty entry drops the key. */
export function setQoderDefaultField(
  defaults: QoderDefaults,
  key: string,
  field: QoderField,
  value: string
): QoderDefaults {
  const current: QoderModelDefault = { ...(defaults[key] || {}) };
  if (!value) {
    delete current[field];
  } else {
    current[field] = value;
  }
  const next: QoderDefaults = { ...defaults };
  if (!current.thinking && !current.context) {
    delete next[key];
  } else {
    next[key] = current;
  }
  return next;
}

export function qoderThinkingValues(row: QoderCatalogModel): string[] {
  const values: string[] = [];
  if (row.zeroAllowed || row.thinkingLevels.length > 0) values.push('off');
  values.push(...row.thinkingLevels);
  return values;
}

export function qoderContextValues(row: QoderCatalogModel): string[] {
  return row.contextSizes.length > 0 ? row.contextSizes : [...QODER_CONTEXT_SIZES];
}

export function applyQoderDefaultField(
  defaults: QoderDefaults,
  rows: readonly QoderCatalogModel[],
  field: QoderField,
  value: string
): { next: QoderDefaults; applied: number; skipped: number } {
  if (value === '' || value === QODER_INHERIT) {
    const next = rows.reduce(
      (acc, row) => setQoderDefaultField(acc, row.key, field, ''),
      defaults
    );
    return { next, applied: rows.length, skipped: 0 };
  }

  let applied = 0;
  let skipped = 0;
  const next = rows.reduce((acc, row) => {
    const allowed = field === 'thinking' ? qoderThinkingValues(row) : qoderContextValues(row);
    if (!allowed.includes(value)) {
      skipped += 1;
      return acc;
    }
    applied += 1;
    return setQoderDefaultField(acc, row.key, field, value);
  }, defaults);
  return { next, applied, skipped };
}

const filledEntry = (entry: QoderModelDefault | undefined): QoderModelDefault | null => {
  const thinking = entry?.thinking?.trim() ?? '';
  const context = entry?.context?.trim() ?? '';
  if (!thinking && !context) return null;
  return {
    ...(thinking ? { thinking } : {}),
    ...(context ? { context } : {}),
  };
};

/** Key order does not matter. An empty entry counts as absent. */
export function qoderDefaultsEqual(left: QoderDefaults, right: QoderDefaults): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    const a = filledEntry(left[key]);
    const b = filledEntry(right[key]);
    if (!a && !b) continue;
    if (!a || !b) return false;
    if (a.thinking !== b.thinking || a.context !== b.context) return false;
  }
  return true;
}

export function isQoderRowCustom(defaults: QoderDefaults, key: string): boolean {
  return filledEntry(defaults[key]) !== null;
}

export function countQoderOverrides(defaults: QoderDefaults): number {
  return Object.keys(defaults).filter((key) => isQoderRowCustom(defaults, key)).length;
}

export function filterQoderRows(
  rows: readonly QoderCatalogModel[],
  defaults: QoderDefaults,
  query: string,
  onlyCustom: boolean
): QoderCatalogModel[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (onlyCustom && !isQoderRowCustom(defaults, row.key)) return false;
    if (!needle) return true;
    return (
      row.displayName.toLowerCase().includes(needle) || row.key.toLowerCase().includes(needle)
    );
  });
}

/** Levels that appear in `rows`, in catalog order. Unknown levels follow, sorted. */
export function unionThinkingLevels(rows: readonly QoderCatalogModel[]): string[] {
  const present = new Set<string>();
  rows.forEach((row) => {
    row.thinkingLevels.forEach((level) => present.add(level));
  });
  const known = QODER_THINKING_LEVELS.filter((level) => present.has(level));
  const unknown = [...present]
    .filter((level) => !(QODER_THINKING_LEVELS as readonly string[]).includes(level))
    .sort();
  return [...known, ...unknown];
}

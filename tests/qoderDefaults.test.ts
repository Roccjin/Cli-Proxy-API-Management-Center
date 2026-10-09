import { describe, expect, test } from 'bun:test';
import {
  QODER_INHERIT,
  applyQoderDefaultField,
  filterQoderRows,
  qoderDefaultsEqual,
  setQoderDefaultField,
  unionThinkingLevels,
} from '@/features/authFiles/qoderDefaultsLogic';
import {
  catalogFromV1Models,
  extractCatalogDefault,
  extractContextSizes,
  fallbackQoderCatalog,
  mergeCatalogWithDefaults,
  normalizeQoderCatalog,
  normalizeQoderModelDefaults,
  type QoderCatalogModel,
} from '../src/services/api/qoderDefaults';

describe('Qoder model defaults', () => {
  test('extracts context sizes from Qoder context_config and always keeps 200K/400K/1M', () => {
    expect(
      extractContextSizes({
        '1M': { token_count: 1000000 },
        '200K': { is_default: true, token_count: 200000 },
        '400K': { token_count: 400000 },
      })
    ).toEqual(['200K', '400K', '1M']);
    expect(extractContextSizes(undefined)).toEqual(['200K', '400K', '1M']);
    expect(extractCatalogDefault({
      '1M': { token_count: 1000000 },
      '200K': { is_default: true, token_count: 200000 },
    })).toBe('200K');
  });

  test('normalizes management catalog rows', () => {
    const rows = normalizeQoderCatalog({
      models: [
        {
          key: 'qoder/dfmodel',
          display_name: 'DeepSeek-V4-Flash',
          thinking_levels: ['high', 'max'],
          zero_allowed: true,
          context_sizes: ['200K', '1M'],
          catalog_context: '200K',
        },
      ],
    });
    expect(rows).toEqual([
      {
        key: 'dfmodel',
        displayName: 'DeepSeek-V4-Flash',
        thinkingLevels: ['high', 'max'],
        zeroAllowed: true,
        contextSizes: ['200K', '400K', '1M'],
        catalogContext: '200K',
      },
    ]);
  });

  test('keeps saved default keys that are missing from the live catalog', () => {
    const rows = mergeCatalogWithDefaults(
      [{ key: 'dfmodel', displayName: 'Flash', thinkingLevels: [], zeroAllowed: false, contextSizes: ['200K', '400K', '1M'], catalogContext: '200K' }],
      { dmodel: { context: '1M' } }
    );
    expect(rows.map((row) => row.key)).toEqual(['dfmodel', 'dmodel']);
  });

  test('reads defaults and v1 model fallbacks', () => {
    expect(
      normalizeQoderModelDefaults({
        'qoder-model-defaults': {
          'qoder/dfmodel': { thinking: 'max', context: '1m' },
        },
      })
    ).toEqual({ dfmodel: { thinking: 'max', context: '1M' } });

    const fromV1 = catalogFromV1Models([
      {
        name: 'qoder/dfmodel',
        alias: 'DeepSeek-V4-Flash',
        type: 'qoder',
        thinking: { levels: ['high', 'max'], zero_allowed: true },
        contextConfig: {
          '200K': { is_default: true, token_count: 200000 },
          '1M': { token_count: 1000000 },
        },
      },
    ]);
    expect(fromV1[0]?.key).toBe('dfmodel');
    expect(fromV1[0]?.catalogContext).toBe('200K');
    expect(fromV1[0]?.contextSizes).toEqual(['200K', '400K', '1M']);
  });

  test('static fallback catalog always includes dfmodel and 1M', () => {
    const rows = fallbackQoderCatalog();
    expect(rows.some((row) => row.key === 'dfmodel')).toBe(true);
    expect(rows[0]?.contextSizes).toEqual(['200K', '400K', '1M']);
  });
});

const model = (overrides: Partial<QoderCatalogModel>): QoderCatalogModel => ({
  key: 'model',
  displayName: 'Model',
  thinkingLevels: [],
  zeroAllowed: false,
  contextSizes: ['200K', '400K', '1M'],
  catalogContext: '200K',
  ...overrides,
});

describe('qoder default editing', () => {
  test('setQoderDefaultField removes an emptied key without mutating the input', () => {
    const input = Object.freeze({ a: Object.freeze({ thinking: 'max' }) });
    const next = setQoderDefaultField(input, 'a', 'thinking', '');
    expect(next).toEqual({});
    expect(input).toEqual({ a: { thinking: 'max' } });
  });

  test('applyQoderDefaultField writes only rows that support the value', () => {
    const rows = [
      model({ key: 'a', thinkingLevels: ['high', 'max'], zeroAllowed: false }),
      model({ key: 'b', thinkingLevels: [], zeroAllowed: false }),
    ];
    const thinking = applyQoderDefaultField({}, rows, 'thinking', 'max');
    expect(thinking.applied).toBe(1);
    expect(thinking.skipped).toBe(1);
    expect(thinking.next).toEqual({ a: { thinking: 'max' } });

    const context = applyQoderDefaultField({}, rows, 'context', '1M');
    expect(context.next).toEqual({ a: { context: '1M' }, b: { context: '1M' } });

    const cleared = applyQoderDefaultField(
      { a: { thinking: 'max' }, b: { thinking: 'high' } },
      rows,
      'thinking',
      QODER_INHERIT
    );
    expect(cleared.applied).toBe(2);
    expect(cleared.skipped).toBe(0);
    expect(cleared.next).toEqual({});
  });

  test('qoderDefaultsEqual ignores key order and empty entries', () => {
    expect(qoderDefaultsEqual({ b: { context: '1M' }, a: { thinking: 'max' } }, {
      a: { thinking: 'max' },
      b: { context: '1M' },
    })).toBe(true);
    expect(qoderDefaultsEqual({ a: {} }, {})).toBe(true);
    expect(qoderDefaultsEqual({ a: { thinking: 'max' } }, { a: { thinking: 'high' } })).toBe(false);
  });

  test('filterQoderRows matches name or key and can keep overrides only', () => {
    const rows = [
      model({ key: 'gmodel', displayName: 'GLM-5.3' }),
      model({ key: 'dfmodel', displayName: 'DeepSeek-Flash' }),
    ];
    const defaults = { gmodel: { context: '1M' } };
    expect(filterQoderRows(rows, defaults, 'glm', false).map((row) => row.key)).toEqual(['gmodel']);
    expect(filterQoderRows(rows, defaults, 'DFMODEL', false).map((row) => row.key)).toEqual([
      'dfmodel',
    ]);
    expect(filterQoderRows(rows, defaults, '', true).map((row) => row.key)).toEqual(['gmodel']);
  });

  test('unionThinkingLevels follows the catalog order', () => {
    const rows = [
      model({ thinkingLevels: ['max', 'low'] }),
      model({ key: 'b', thinkingLevels: ['high'] }),
    ];
    expect(unionThinkingLevels(rows)).toEqual(['low', 'high', 'max']);
  });
});

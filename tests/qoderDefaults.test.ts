import { describe, expect, test } from 'bun:test';
import {
  catalogFromV1Models,
  extractCatalogDefault,
  extractContextSizes,
  fallbackQoderCatalog,
  mergeCatalogWithDefaults,
  normalizeQoderCatalog,
  normalizeQoderModelDefaults,
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

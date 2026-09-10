import { describe, expect, test } from 'bun:test';
import { readCodeBuddyQuotaSnapshot, readCodeBuddyQuotaView } from '@/features/quota/providers/codebuddy/data';
import { collectQuotaRowInstants } from '@/features/quota/resetSchedule';

describe('readCodeBuddyQuotaSnapshot', () => {
  test('reads the management usage envelope', () => {
    const usage = {
      site: 'global',
      total_remain: 40,
      total_used: 60,
      total_size: 100,
      pack_count: 1,
      packages: [{ name: 'Intl Pack', remain: 40, used: 60, size: 100 }],
    };
    expect(readCodeBuddyQuotaSnapshot({ usage })).toEqual(usage);
  });

  test('returns null for unrelated payloads', () => {
    expect(readCodeBuddyQuotaSnapshot({ status: 'ok' })).toBeNull();
  });
});

describe('readCodeBuddyQuotaView', () => {
  test('aggregates remaining percent and package cycle ends', () => {
    const view = readCodeBuddyQuotaView({
      site: 'global',
      total_remain: 80,
      total_used: 20,
      total_size: 100,
      pack_count: 1,
      packages: [
        {
          name: '加油包',
          remain: 80,
          used: 20,
          size: 100,
          cycle_end: '2026-10-01 12:00:00',
        },
      ],
    });
    expect(view?.site).toBe('global');
    expect(view?.remainingPercent).toBe(80);
    expect(view?.packages[0]?.name).toBe('加油包');
    expect(view?.packages[0]?.cycleEnd).toBe('2026-10-01 12:00:00');
  });

  test('treats missing site as international', () => {
    const view = readCodeBuddyQuotaView({ total_remain: 1, total_size: 1, packages: [] });
    expect(view?.site).toBe('global');
  });
});

describe('collectQuotaRowInstants for codebuddy', () => {
  test('uses package cycle end as the recovery instant', () => {
    const instants = collectQuotaRowInstants('codebuddy', {
      status: 'success',
      usage: {
        packages: [{ name: 'Intl Pack', cycle_end: '2026-10-01T00:00:00Z' }],
      },
    });
    expect(instants).toHaveLength(1);
    expect(instants[0]?.rowId).toBe('Intl Pack');
    expect(instants[0]?.atMs).toBe(Date.parse('2026-10-01T00:00:00Z'));
  });
});

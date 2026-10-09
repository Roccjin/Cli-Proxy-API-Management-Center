import { describe, expect, test } from 'bun:test';
import { readCodeBuddyQuotaSnapshot, readCodeBuddyQuotaView } from '@/features/quota/providers/codebuddy/data';
import {
  groupBuddyCreditPackages,
  isBuddyPackageListCollapsible,
  sortBuddyPackagesByExpiry,
  type BuddyCreditPackage,
} from '@/features/quota/providers/buddy/credits';
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

const credit = (
  name: string,
  remain: number,
  cycleEnd: string | null
): BuddyCreditPackage => ({
  name,
  remain,
  used: 0,
  size: remain,
  remainingPercent: remain > 0 ? 100 : null,
  cycleEnd,
});

describe('buddy credit grouping', () => {
  test('merges same names and sorts groups by earliest expiry', () => {
    const groups = groupBuddyCreditPackages([
      credit('Free Plan Subscription', 100, '2026-10-31 23:59:00'),
      credit('Bonus Pack', 30, '2026-10-22 02:26:00'),
      credit('Bonus Pack', 30, '2026-10-23 00:00:00'),
      credit('Bonus Pack', 30, '2026-11-09 12:29:00'),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      name: 'Bonus Pack',
      count: 3,
      remain: 90,
      size: 90,
      earliestEnd: '2026-10-22 02:26:00',
      latestEnd: '2026-11-09 12:29:00',
    });
    expect(groups[1]).toMatchObject({ name: 'Free Plan Subscription', count: 1 });
  });

  test('does not merge packages with an empty name', () => {
    const groups = groupBuddyCreditPackages([
      credit('Bonus Pack', 10, null),
      credit('  ', 5, '2026-10-01 00:00:00'),
      credit('', 7, '2026-10-02 00:00:00'),
    ]);
    const unnamed = groups.filter((group) => group.name === '');
    expect(unnamed.map((group) => group.fallbackIndex)).toEqual([2, 3]);
  });

  test('sorts a group with no parseable expiry last', () => {
    const groups = groupBuddyCreditPackages([
      credit('Later', 1, 'not-a-date'),
      credit('Soon', 1, '2026-10-01 00:00:00'),
    ]);
    expect(groups.map((group) => group.name)).toEqual(['Soon', 'Later']);
  });

  test('sortBuddyPackagesByExpiry keeps equal expiries in input order', () => {
    const sorted = sortBuddyPackagesByExpiry([
      credit('first', 1, '2026-10-22 00:00:00'),
      credit('second', 1, '2026-10-22 00:00:00'),
      credit('earlier', 1, '2026-10-21 00:00:00'),
    ]);
    expect(sorted.map((pkg) => pkg.name)).toEqual(['earlier', 'first', 'second']);
    expect(sorted.map((pkg) => pkg.originalIndex)).toEqual([2, 0, 1]);
  });

  test('isBuddyPackageListCollapsible', () => {
    expect(isBuddyPackageListCollapsible(3, 3)).toBe(false);
    expect(isBuddyPackageListCollapsible(4, 4)).toBe(true);
    expect(isBuddyPackageListCollapsible(2, 1)).toBe(true);
  });
});

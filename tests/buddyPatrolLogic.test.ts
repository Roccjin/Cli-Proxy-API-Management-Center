import { describe, expect, test } from 'bun:test';
import {
  applicablePatrolKinds,
  defaultCreditsSettings,
  filterPatrolAccounts,
  isCreditsPatrolTarget,
  isValidGoDuration,
  isValidMinRemain,
  mergeDraftAfterReload,
  normalizeBuddyPatrol,
  patrolResultTone,
  settingsDirty,
  summarizePatrolTask,
  toPatrolPatchBody,
} from '@/features/patrol/logic';
import type { PatrolAccount } from '@/features/patrol/types';

describe('isValidGoDuration', () => {
  test('accepts Go duration strings', () => {
    expect(isValidGoDuration('12h')).toBe(true);
    expect(isValidGoDuration('24h')).toBe(true);
    expect(isValidGoDuration('45s')).toBe(true);
    expect(isValidGoDuration('1h30m')).toBe(true);
    expect(isValidGoDuration(' 10m ')).toBe(true);
  });

  test('rejects empty or unitless values', () => {
    expect(isValidGoDuration('')).toBe(false);
    expect(isValidGoDuration('12')).toBe(false);
    expect(isValidGoDuration('12 hours')).toBe(false);
  });
});

describe('normalizeBuddyPatrol', () => {
  test('maps kebab-case payload and skips non-buddy accounts', () => {
    const state = normalizeBuddyPatrol({
      'home-mode': false,
      credits: { enabled: false, interval: '6h', 'min-account-interval': '30s' },
      activity: { enabled: true, interval: '12h', model: 'hy3' },
      'web-daily': { enabled: false, interval: '36h', model: 'hy3' },
      accounts: [
        {
          id: 'a',
          name: 'alice.json',
          email: 'alice@example.com',
          provider: 'codebuddy',
          disabled: true,
          disabled_reason: 'credits_exhausted',
          region: 'global',
          activity_eligible: true,
          web_daily_eligible: false,
          credits: { at: '2026-09-21T01:00:00Z', result: 'still_empty', remain: 0 },
          activity: { result: 'ok' },
        },
        { id: 'g', name: 'gemini.json', provider: 'gemini' },
      ],
    });

    expect(state.credits.enabled).toBe(false);
    expect(state.credits.interval).toBe('6h');
    expect(state.credits.minAccountInterval).toBe('30s');
    expect(state.activity.model).toBe('hy3');
    expect(state.webDaily.enabled).toBe(false);
    expect(state.webDaily.interval).toBe('36h');
    expect(state.webDaily.model).toBe('hy3');
    expect(state.accounts).toHaveLength(1);
    expect(state.accounts[0]?.credits?.remain).toBe(0);
    expect(state.accounts[0]?.activity?.result).toBe('ok');
    expect(state.accounts[0]?.webDailyEligible).toBe(false);
  });
});

describe('toPatrolPatchBody', () => {
  test('emits kebab-case activity fields', () => {
    expect(
      toPatrolPatchBody('activity', { enabled: true, interval: '24h', model: 'hy3' })
    ).toEqual({
      activity: { enabled: true, interval: '24h', model: 'hy3' },
    });
    expect(
      toPatrolPatchBody('webDaily', { enabled: false, interval: '12h', model: 'hy3' })
    ).toEqual({
      'web-daily': { enabled: false, interval: '12h', model: 'hy3' },
    });
    expect(toPatrolPatchBody('credits', { interval: '12h', minRemain: 10 })).toEqual({
      credits: { interval: '12h', 'min-remain': 10 },
    });
  });
});

describe('isValidMinRemain', () => {
  test('accepts zero and positive numbers', () => {
    expect(isValidMinRemain(0)).toBe(true);
    expect(isValidMinRemain(1)).toBe(true);
    expect(isValidMinRemain(10.5)).toBe(true);
    expect(isValidMinRemain(-1)).toBe(false);
    expect(isValidMinRemain(Number.NaN)).toBe(false);
  });
});

describe('settingsDirty', () => {
  test('ignores model when not requested', () => {
    const saved = normalizeBuddyPatrol({}).credits;
    expect(settingsDirty({ ...saved, model: 'hy3' }, saved, false)).toBe(false);
    expect(settingsDirty({ ...saved, interval: '6h' }, saved, false)).toBe(true);
    expect(settingsDirty({ ...saved, minRemain: 10 }, saved, false)).toBe(false);
    expect(settingsDirty({ ...saved, minRemain: 10 }, saved, false, true)).toBe(true);
  });
});

describe('patrolResultTone', () => {
  test('classifies known results', () => {
    expect(patrolResultTone('reenabled')).toBe('ok');
    expect(patrolResultTone('still_empty')).toBe('warn');
    expect(patrolResultTone('failed')).toBe('bad');
    expect(patrolResultTone('')).toBe('muted');
  });
});

const account = (overrides: Partial<PatrolAccount> = {}): PatrolAccount => ({
  id: 'id',
  name: 'file.json',
  email: 'a@example.com',
  provider: 'codebuddy',
  disabled: false,
  disabledReason: '',
  region: 'global',
  activityEligible: false,
  webDailyEligible: false,
  ...overrides,
});

describe('mergeDraftAfterReload', () => {
  test('keeps an unsaved interval when another task field is saved', () => {
    const prev = defaultCreditsSettings();
    const draft = { ...prev, interval: '6h' };
    const next = { ...prev, enabled: false };
    const merged = mergeDraftAfterReload(draft, prev, next, ['enabled']);
    expect(merged.interval).toBe('6h');
    expect(merged.enabled).toBe(false);
  });

  test('accepts a normalized interval after save', () => {
    const prev = defaultCreditsSettings();
    const draft = { ...prev, interval: '720m' };
    const next = { ...prev, interval: '12h' };
    expect(mergeDraftAfterReload(draft, prev, next, ['interval']).interval).toBe('12h');
  });

  test('follows the server when nothing was edited', () => {
    const prev = defaultCreditsSettings();
    const next = { ...prev, enabled: false, interval: '6h' };
    expect(mergeDraftAfterReload(prev, prev, next)).toEqual(next);
  });
});

describe('patrol account filters', () => {
  test('applicablePatrolKinds follows eligibility', () => {
    expect(
      applicablePatrolKinds(
        account({ disabled: true, disabledReason: 'credits_exhausted', activityEligible: true })
      )
    ).toEqual(['credits', 'activity']);
    expect(
      isCreditsPatrolTarget(account({ disabled: true, disabledReason: 'credits_reserve' }))
    ).toBe(true);
    expect(isCreditsPatrolTarget(account({ disabled: true, disabledReason: 'manual' }))).toBe(
      false
    );
    expect(applicablePatrolKinds(account({ webDailyEligible: true }))).toEqual(['webDaily']);
  });

  test('summarizePatrolTask counts applicable results', () => {
    const summary = summarizePatrolTask('activity', [
      account({ id: '1', activityEligible: true, activity: { at: 't', result: 'ok' } }),
      account({ id: '2', activityEligible: true, activity: { at: 't', result: 'failed' } }),
      account({ id: '3', activityEligible: true }),
      account({ id: '4', activity: { at: 't', result: 'ok' } }),
    ]);
    expect(summary).toEqual({ relevant: 3, ok: 1, warn: 0, bad: 1, never: 1 });
  });

  test('filterPatrolAccounts matches provider, query, and status', () => {
    const rows = [
      account({ id: 'ann', provider: 'codebuddy', email: 'Ann@x.com', name: 'ann.json' }),
      account({
        id: 'bob',
        provider: 'workbuddy',
        email: 'bob@x.com',
        name: 'bob.json',
        disabled: true,
      }),
      account({ id: 'pending', webDailyEligible: true }),
      account({
        id: 'done',
        webDailyEligible: true,
        webDaily: { at: 't', result: 'ok' },
      }),
    ];
    expect(
      filterPatrolAccounts(rows, { provider: 'workbuddy', query: '', filter: 'all' }).map(
        (row) => row.id
      )
    ).toEqual(['bob']);
    expect(
      filterPatrolAccounts(rows, { provider: 'all', query: 'ANN', filter: 'all' }).map(
        (row) => row.id
      )
    ).toEqual(['ann']);
    expect(
      filterPatrolAccounts(rows, { provider: 'all', query: 'bob.json', filter: 'all' }).map(
        (row) => row.id
      )
    ).toEqual(['bob']);
    expect(
      filterPatrolAccounts(rows, { provider: 'all', query: '', filter: 'attention' }).map(
        (row) => row.id
      )
    ).toEqual(['bob']);
    expect(
      filterPatrolAccounts(rows, { provider: 'all', query: '', filter: 'disabled' }).map(
        (row) => row.id
      )
    ).toEqual(['bob']);
    expect(
      filterPatrolAccounts(rows, { provider: 'all', query: '', filter: 'pending' }).map(
        (row) => row.id
      )
    ).toEqual(['pending']);
  });
});

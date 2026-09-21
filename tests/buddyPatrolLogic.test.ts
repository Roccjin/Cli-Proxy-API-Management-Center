import { describe, expect, test } from 'bun:test';
import {
  isValidGoDuration,
  normalizeBuddyPatrol,
  patrolResultTone,
  settingsDirty,
  toPatrolPatchBody,
} from '@/features/patrol/logic';

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
    expect(state.accounts).toHaveLength(1);
    expect(state.accounts[0]?.credits?.remain).toBe(0);
    expect(state.accounts[0]?.activity?.result).toBe('ok');
  });
});

describe('toPatrolPatchBody', () => {
  test('emits kebab-case activity fields', () => {
    expect(
      toPatrolPatchBody('activity', { enabled: true, interval: '24h', model: 'hy3' })
    ).toEqual({
      activity: { enabled: true, interval: '24h', model: 'hy3' },
    });
  });
});

describe('settingsDirty', () => {
  test('ignores model when not requested', () => {
    const saved = normalizeBuddyPatrol({}).credits;
    expect(settingsDirty({ ...saved, model: 'hy3' }, saved, false)).toBe(false);
    expect(settingsDirty({ ...saved, interval: '6h' }, saved, false)).toBe(true);
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

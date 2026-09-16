import { describe, expect, test } from 'bun:test';
import {
  isCreditsExhaustedDisabled,
  isProblemAuthFile,
  withAuthFileDisabledState,
} from '../src/features/authFiles/constants';
import type { AuthFileItem } from '../src/types';

const authFile = (overrides: Partial<AuthFileItem> = {}): AuthFileItem => ({
  name: 'credential.json',
  type: 'codex',
  ...overrides,
});

describe('auth file problem status', () => {
  test('does not classify a deliberately disabled credential as a problem', () => {
    expect(
      isProblemAuthFile(
        authFile({
          disabled: true,
          status: 'disabled',
          statusMessage: 'disabled via management API',
        })
      )
    ).toBe(false);
  });

  test('also respects the backend disabled status when the boolean is absent', () => {
    expect(
      isProblemAuthFile(
        authFile({
          status: ' DISABLED ',
          statusMessage: 'disabled via management API',
        })
      )
    ).toBe(false);
  });

  test('ignores healthy status messages', () => {
    expect(isProblemAuthFile(authFile({ status: 'active', statusMessage: 'ok' }))).toBe(false);
  });

  test('detects warning messages, unavailable credentials, and error status', () => {
    expect(isProblemAuthFile(authFile({ statusMessage: 'quota exhausted' }))).toBe(true);
    expect(isProblemAuthFile(authFile({ unavailable: true }))).toBe(true);
    expect(isProblemAuthFile(authFile({ status: 'error' }))).toBe(true);
  });
});

describe('credits-exhausted disabled state', () => {
  test('recognizes a boolean-disabled credential with the credits_exhausted reason', () => {
    expect(
      isCreditsExhaustedDisabled(authFile({ disabled: true, disabledReason: 'credits_exhausted' }))
    ).toBe(true);
  });

  test('recognizes status-only disabled with a snake_case reason', () => {
    expect(
      isCreditsExhaustedDisabled(
        authFile({ status: ' DISABLED ', disabled_reason: ' CREDITS_EXHAUSTED ' })
      )
    ).toBe(true);
  });

  test('does not recognize an active credential carrying the same reason', () => {
    expect(
      isCreditsExhaustedDisabled(authFile({ status: 'active', disabledReason: 'credits_exhausted' }))
    ).toBe(false);
  });

  test('does not recognize disabled credentials with a missing or different reason', () => {
    expect(isCreditsExhaustedDisabled(authFile({ disabled: true }))).toBe(false);
    expect(
      isCreditsExhaustedDisabled(authFile({ disabled: true, disabledReason: 'manual' }))
    ).toBe(false);
  });

  test('re-enabling clears disabled metadata, status message, and the unavailable flag', () => {
    const next = withAuthFileDisabledState(
      authFile({
        disabled: true,
        status: 'disabled',
        statusMessage: 'WorkBuddy credits exhausted',
        status_message: 'WorkBuddy credits exhausted',
        unavailable: true,
        disabledReason: 'credits_exhausted',
        disabled_reason: 'credits_exhausted',
        disabledProviderCode: '14018',
        disabled_provider_code: '14018',
        disabledAt: '2026-09-16T00:00:00.000Z',
        disabled_at: '2026-09-16T00:00:00.000Z',
      }),
      false
    );

    expect(next.disabled).toBe(false);
    expect(next.status).toBe('active');
    expect(next.unavailable).toBe(false);
    expect(next.statusMessage).toBeUndefined();
    expect(next['status_message']).toBeUndefined();
    expect(next.disabledReason).toBeUndefined();
    expect(next['disabled_reason']).toBeUndefined();
    expect(next.disabledProviderCode).toBeUndefined();
    expect(next['disabled_provider_code']).toBeUndefined();
    expect(next.disabledAt).toBeUndefined();
    expect(next['disabled_at']).toBeUndefined();
  });

  test('disabling keeps the credits-exhausted metadata available for display', () => {
    const next = withAuthFileDisabledState(
      authFile({ disabledReason: 'credits_exhausted', statusMessage: 'stale warning' }),
      true
    );

    expect(next.disabled).toBe(true);
    expect(next.status).toBe('disabled');
    expect(next.disabledReason).toBe('credits_exhausted');
    expect(next.statusMessage).toBe('stale warning');
  });
});

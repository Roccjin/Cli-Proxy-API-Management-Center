import { describe, expect, test } from 'bun:test';
import { createLatestUsageRequestGuard } from '../src/pages/usage-page-request-guard';

describe('UsagePage request ordering', () => {
  test('only the newest concurrent request may commit state or clear loading', () => {
    const guard = createLatestUsageRequestGuard();
    const first = guard.begin();
    const second = guard.begin();

    expect(guard.isLatest(first)).toBe(false);
    expect(guard.isLatest(second)).toBe(true);
  });

  test('invalidates an in-flight request when the page unmounts', () => {
    const guard = createLatestUsageRequestGuard();
    const request = guard.begin();

    guard.invalidate();

    expect(guard.isLatest(request)).toBe(false);
  });

  test('a stale failure is not eligible for propagation after a newer success', () => {
    const guard = createLatestUsageRequestGuard();
    const staleFailure = guard.begin();
    const newerSuccess = guard.begin();

    expect(guard.isLatest(newerSuccess)).toBe(true);
    expect(guard.isLatest(staleFailure)).toBe(false);
  });
});

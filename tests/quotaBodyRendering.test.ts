/**
 * Provider bodies rendered end-to-end.
 *
 * Bodies receive their class map as a prop and import no stylesheet, so unlike
 * QuotaCard they can be rendered directly here — which is the only place the
 * "absolute plus countdown" pairing is checked as actual markup rather than as
 * a formatter's return value.
 */

import { beforeAll, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '@/i18n';
import { CodexQuotaBody } from '@/features/quota/providers/codex/CodexQuotaBody';
import { ClaudeQuotaBody } from '@/features/quota/providers/claude/ClaudeQuotaBody';
import { CodeBuddyQuotaBody } from '@/features/quota/providers/codebuddy/CodeBuddyQuotaBody';
import { KimiQuotaBody } from '@/features/quota/providers/kimi/KimiQuotaBody';
import { QoderQuotaBody } from '@/features/quota/providers/qoder/QoderQuotaBody';
import { WorkBuddyQuotaBody } from '@/features/quota/providers/workbuddy/WorkBuddyQuotaBody';
import { QUOTA_CLASS_KEYS, bindQuotaClasses } from '@/features/quota/types';
import { formatInstantShort } from '@/utils/quota';
import { DAY_MS, HOUR_MS } from '@/utils/time/durations';
import type {
  ClaudeQuotaState,
  CodeBuddyQuotaState,
  CodexQuotaState,
  KimiQuotaState,
  QoderQuotaState,
} from '@/types';

const classes = bindQuotaClasses(
  Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
  'test-host'
);

/**
 * useNow() freezes to module-load time under renderToStaticMarkup (it reads
 * getServerSnapshot), so instants are placed relative to the real clock.
 */
const now = Date.now();

// The i18n fallback is zh-CN; pin English so the countdown assertions read.
beforeAll(async () => {
  await i18n.changeLanguage('en');
});

describe('CodexQuotaBody', () => {
  const quota: CodexQuotaState = {
    status: 'success',
    planType: 'pro',
    windows: [
      {
        id: 'primary',
        label: '5-hour limit',
        usedPercent: 38,
        resetLabel: '08-02 18:00',
        resetAtMs: now + 3 * HOUR_MS,
        periodHours: 5,
      },
    ],
    rateLimitResetCredits: [
      {
        id: 'credit-1',
        status: 'available',
        grantedAt: new Date(now - DAY_MS).toISOString(),
        expiresAt: new Date(now + 11 * DAY_MS).toISOString(),
      },
    ],
    rateLimitResetCreditsAvailableCount: 1,
  };

  test('renders a window reset as absolute plus countdown', () => {
    const markup = renderToStaticMarkup(createElement(CodexQuotaBody, { quota, classes }));

    expect(markup).toContain('08-02 18:00');
    expect(markup).toContain('quotaResetRelative');
    expect(markup).toMatch(/3 hours/);
  });

  test('renders reset-credit expiry in local time with a countdown', () => {
    const markup = renderToStaticMarkup(createElement(CodexQuotaBody, { quota, classes }));

    expect(markup).toContain(formatInstantShort(now + 11 * DAY_MS));
    expect(markup).toMatch(/11 days/);
  });

  test('highlights a credit expiring within the final hour', () => {
    const creditFirst: CodexQuotaState = {
      ...quota,
      windows: [{ ...quota.windows[0], resetAtMs: now + 5 * DAY_MS }],
      rateLimitResetCredits: [
        {
          id: 'credit-1',
          status: 'available',
          grantedAt: new Date(now - DAY_MS).toISOString(),
          expiresAt: new Date(now + 30 * 60_000).toISOString(),
        },
      ],
    };
    const markup = renderToStaticMarkup(
      createElement(CodexQuotaBody, { quota: creditFirst, classes })
    );

    expect(markup).toContain('codexResetCreditRowSoon');
    expect(markup).not.toContain('quotaRowSoon');
  });

  test('does not emphasize a reset countdown more than one hour away', () => {
    const markup = renderToStaticMarkup(createElement(CodexQuotaBody, { quota, classes }));

    expect(markup).not.toContain('quotaRowSoon');
    expect(markup).not.toContain('quotaResetRelativeSoon');
    expect(markup).not.toContain('codexResetCreditRowSoon');
  });

  test('emphasizes a reset countdown within the final hour', () => {
    const urgent: CodexQuotaState = {
      ...quota,
      windows: [{ ...quota.windows[0], resetAtMs: now + 30 * 60_000 }],
    };
    const markup = renderToStaticMarkup(createElement(CodexQuotaBody, { quota: urgent, classes }));

    expect(markup).toContain('quotaResetRelativeSoon');
  });

  test('highlights nothing once every instant is in the past', () => {
    const stale: CodexQuotaState = {
      ...quota,
      windows: [{ ...quota.windows[0], resetAtMs: now - HOUR_MS }],
      rateLimitResetCredits: [],
      rateLimitResetCreditsAvailableCount: null,
    };
    const markup = renderToStaticMarkup(createElement(CodexQuotaBody, { quota: stale, classes }));

    expect(markup).not.toContain('Soon');
  });

  test('keeps the baked label alone when the store entry predates resetAtMs', () => {
    const stale: CodexQuotaState = {
      ...quota,
      windows: [{ ...quota.windows[0], resetAtMs: undefined, periodHours: undefined }],
      rateLimitResetCredits: [],
      rateLimitResetCreditsAvailableCount: null,
    };
    const markup = renderToStaticMarkup(createElement(CodexQuotaBody, { quota: stale, classes }));

    expect(markup).toContain('08-02 18:00');
    expect(markup).not.toContain('quotaResetRelative');
  });
});

describe('KimiQuotaBody', () => {
  test('renders the concrete reset time alongside its countdown', () => {
    const resetAtMs = now + 3 * HOUR_MS;
    const quota: KimiQuotaState = {
      status: 'success',
      rows: [
        {
          id: 'summary',
          label: 'Weekly limit',
          used: 34,
          limit: 100,
          resetHint: '3h',
          resetAtMs,
          periodHours: 168,
        },
      ],
    };
    const markup = renderToStaticMarkup(createElement(KimiQuotaBody, { quota, classes }));

    expect(markup).toContain(formatInstantShort(resetAtMs));
    expect(markup).toContain('quotaResetRelative');
    expect(markup).toMatch(/3 hours/);
    expect(markup).not.toContain('resets in 3h');
  });
});

describe('ClaudeQuotaBody', () => {
  test('pairs each window reset with a countdown', () => {
    const quota: ClaudeQuotaState = {
      status: 'success',
      windows: [
        {
          id: 'five_hour',
          label: '5-hour',
          usedPercent: 12,
          resetLabel: '08-02 17:00',
          resetAtMs: now + 2 * HOUR_MS,
          periodHours: 5,
        },
        {
          id: 'seven_day',
          label: '7-day',
          usedPercent: 60,
          resetLabel: '08-06 04:00',
          resetAtMs: now + 4 * DAY_MS,
          periodHours: 168,
        },
      ],
    };
    const markup = renderToStaticMarkup(createElement(ClaudeQuotaBody, { quota, classes }));

    expect(markup).toContain('08-02 17:00');
    expect(markup).toContain('08-06 04:00');
    expect(markup).toMatch(/2 hours/);
    expect(markup).toMatch(/4 days/);
  });
});

describe('QoderQuotaBody', () => {
  test('renders exhausted quota with warning severity', () => {
    const quota: QoderQuotaState = {
      status: 'success',
      usage: { used: 100, total: 100, is_quota_exceeded: true },
    };

    const markup = renderToStaticMarkup(createElement(QoderQuotaBody, { quota, classes }));

    expect(markup).toContain('quotaWarningMessage');
    expect(markup).toContain('role="alert"');
  });
});

const buddyPackages = (count: number, name: string) =>
  Array.from({ length: count }, (_, index) => ({
    name,
    remain: 30,
    used: 0,
    size: 30,
    cycle_end: new Date(Date.UTC(2026, 9, 22 + index, 2, 26)).toISOString(),
  }));

const buddyQuota = (
  packages: { name: string; remain: number; used: number; size: number; cycle_end?: string }[]
): CodeBuddyQuotaState => ({
  status: 'success',
  usage: {
    site: 'global',
    total_remain: 610,
    total_size: 610,
    pack_count: packages.length,
    packages,
  },
});

describe('CodeBuddyQuotaBody', () => {
  test('collapses repeated packs behind a toggle', () => {
    const quota = buddyQuota([
      { name: 'Free Plan Subscription', remain: 100, used: 0, size: 100 },
      ...buddyPackages(18, 'Bonus Pack'),
    ]);
    const markup = renderToStaticMarkup(createElement(CodeBuddyQuotaBody, { quota, classes }));

    expect(markup).toContain('Bonus Pack ×18');
    expect(markup).toContain('Free Plan Subscription');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('Show all 19 packs');
    expect(markup.match(/class="quotaBar"/g)).toHaveLength(3);
  });

  test('renders a short distinct list without a toggle', () => {
    const quota = buddyQuota([
      { name: 'Alpha', remain: 10, used: 0, size: 10, cycle_end: '2026-10-01 00:00:00' },
      { name: 'Beta', remain: 20, used: 0, size: 20, cycle_end: '2026-10-02 00:00:00' },
    ]);
    const markup = renderToStaticMarkup(createElement(CodeBuddyQuotaBody, { quota, classes }));

    expect(markup).not.toContain('aria-expanded');
    expect(markup.match(/class="quotaBar"/g)).toHaveLength(3);
  });
});

describe('WorkBuddyQuotaBody', () => {
  test('collapses repeated packs the same way', () => {
    const quota = buddyQuota([
      { name: 'Free Plan Subscription', remain: 100, used: 0, size: 100 },
      ...buddyPackages(18, 'Bonus Pack'),
    ]);
    const markup = renderToStaticMarkup(createElement(WorkBuddyQuotaBody, { quota, classes }));

    expect(markup).toContain('Bonus Pack ×18');
    expect(markup).toContain('aria-expanded="false"');
  });
});

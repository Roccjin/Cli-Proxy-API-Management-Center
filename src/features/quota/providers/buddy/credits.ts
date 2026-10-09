/** Buddy credit packages: group same names and fold long lists. */

export const BUDDY_COLLAPSED_ROW_LIMIT = 3;

export type BuddyCreditPackage = {
  name: string;
  remain: number;
  used: number;
  size: number;
  remainingPercent: number | null;
  cycleEnd: string | null;
};

export type BuddyCreditGroup = {
  key: string;
  name: string;
  fallbackIndex: number;
  count: number;
  remain: number;
  used: number;
  size: number;
  remainingPercent: number | null;
  earliestEnd: string | null;
  latestEnd: string | null;
};

/** 'YYYY-MM-DD HH:mm:ss' and ISO. Unparseable values return null. */
export function parseBuddyCycleEndMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const atMs = Date.parse(raw.includes('T') ? raw : raw.replace(' ', 'T'));
  return Number.isFinite(atMs) ? atMs : null;
}

/** MM/DD HH:mm, 24h. Unparseable values are returned unchanged. */
export function formatBuddyCycleEnd(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Earliest expiry first. Unparseable ends sort last. Equal values keep input order. */
export function sortBuddyPackagesByExpiry<T extends { cycleEnd: string | null }>(
  packages: readonly T[]
): Array<T & { originalIndex: number }> {
  return packages
    .map((pkg, originalIndex) => ({ ...pkg, originalIndex }))
    .sort((left, right) =>
      compareExpiry(left.cycleEnd, right.cycleEnd, left.originalIndex, right.originalIndex)
    );
}

export function groupBuddyCreditPackages(
  packages: readonly BuddyCreditPackage[]
): BuddyCreditGroup[] {
  const groups: BuddyCreditGroup[] = [];
  const named = new Map<string, BuddyCreditGroup>();
  const ends = new Map<BuddyCreditGroup, string[]>();

  packages.forEach((pkg, index) => {
    const name = pkg.name.trim();
    const existing = name ? named.get(name) : undefined;
    if (!existing) {
      const group: BuddyCreditGroup = {
        key: name || `#${index}`,
        name,
        fallbackIndex: index + 1,
        count: 1,
        remain: pkg.remain,
        used: pkg.used,
        size: pkg.size,
        remainingPercent: null,
        earliestEnd: pkg.cycleEnd,
        latestEnd: pkg.cycleEnd,
      };
      groups.push(group);
      ends.set(group, pkg.cycleEnd ? [pkg.cycleEnd] : []);
      if (name) named.set(name, group);
      return;
    }
    existing.count += 1;
    existing.remain += pkg.remain;
    existing.used += pkg.used;
    existing.size += pkg.size;
    if (pkg.cycleEnd) ends.get(existing)?.push(pkg.cycleEnd);
  });

  for (const group of groups) {
    group.remainingPercent = percentOf(group.remain, group.size);
    if (group.count === 1) continue;
    const range = earliestAndLatest(ends.get(group) ?? []);
    group.earliestEnd = range.earliest;
    group.latestEnd = range.latest;
  }

  return groups.sort((left, right) =>
    compareExpiry(left.earliestEnd, right.earliestEnd, left.fallbackIndex, right.fallbackIndex)
  );
}

export function isBuddyPackageListCollapsible(packageCount: number, groupCount: number): boolean {
  return packageCount > BUDDY_COLLAPSED_ROW_LIMIT || groupCount < packageCount;
}

const percentOf = (remain: number, size: number): number | null => {
  if (size <= 0) return null;
  return Math.max(0, Math.min(100, (remain / size) * 100));
};

const earliestAndLatest = (
  values: readonly string[]
): { earliest: string | null; latest: string | null } => {
  let earliest: { ms: number; raw: string } | null = null;
  let latest: { ms: number; raw: string } | null = null;
  for (const raw of values) {
    const ms = parseBuddyCycleEndMs(raw);
    if (ms === null) continue;
    if (!earliest || ms < earliest.ms) earliest = { ms, raw };
    if (!latest || ms > latest.ms) latest = { ms, raw };
  }
  return { earliest: earliest?.raw ?? null, latest: latest?.raw ?? null };
};

const compareExpiry = (
  leftEnd: string | null,
  rightEnd: string | null,
  leftOrder: number,
  rightOrder: number
): number => {
  const leftMs = parseBuddyCycleEndMs(leftEnd);
  const rightMs = parseBuddyCycleEndMs(rightEnd);
  if (leftMs === null && rightMs === null) return leftOrder - rightOrder;
  if (leftMs === null) return 1;
  if (rightMs === null) return -1;
  if (leftMs !== rightMs) return leftMs - rightMs;
  return leftOrder - rightOrder;
};

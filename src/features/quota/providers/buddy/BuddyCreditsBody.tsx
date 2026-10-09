/** Shared CodeBuddy / WorkBuddy credit rows, grouped and collapsible. */

import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconChevronDown, IconChevronUp } from '@/components/ui/icons';
import { QuotaMeter } from '../../components/QuotaMeter';
import type { QuotaClassMap } from '../../types';
import {
  BUDDY_COLLAPSED_ROW_LIMIT,
  formatBuddyCycleEnd,
  groupBuddyCreditPackages,
  isBuddyPackageListCollapsible,
  sortBuddyPackagesByExpiry,
  type BuddyCreditGroup,
  type BuddyCreditPackage,
} from './credits';

type BuddyCreditsBodyProps = {
  i18nPrefix: 'codebuddy_quota' | 'workbuddy_quota';
  siteLabel: string;
  totalRemain: number;
  totalSize: number;
  remainingPercent: number | null;
  packCount: number;
  packages: readonly BuddyCreditPackage[];
  classes: QuotaClassMap;
};

const formatAmount = (value: number, unit = ''): string => {
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
};

const percentLabel = (percent: number | null): string =>
  percent === null ? '--' : `${Math.round(percent)}%`;

export function BuddyCreditsBody({
  i18nPrefix,
  siteLabel,
  totalRemain,
  totalSize,
  remainingPercent,
  packCount,
  packages,
  classes,
}: BuddyCreditsBodyProps) {
  const { t } = useTranslation();
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const unit = t(`${i18nPrefix}.unit_default`);
  const groups = useMemo(() => groupBuddyCreditPackages(packages), [packages]);
  const sorted = useMemo(() => sortBuddyPackagesByExpiry(packages), [packages]);
  const collapsible = isBuddyPackageListCollapsible(packages.length, groups.length);
  const visibleGroups = collapsible ? groups.slice(0, BUDDY_COLLAPSED_ROW_LIMIT) : groups;

  const groupLabel = (group: BuddyCreditGroup): string => {
    if (group.count > 1) {
      return t('buddy_quota.group_label', { name: group.name, count: group.count });
    }
    return group.name || t(`${i18nPrefix}.package_fallback`, { index: group.fallbackIndex });
  };

  const groupExpiry = (group: BuddyCreditGroup): string | null => {
    const earliest = formatBuddyCycleEnd(group.earliestEnd);
    const latest = formatBuddyCycleEnd(group.latestEnd);
    if (group.count > 1 && earliest && latest && earliest !== latest) {
      return t('buddy_quota.expires_range', { from: earliest, to: latest });
    }
    if (!group.earliestEnd || !earliest) return null;
    return t(`${i18nPrefix}.expires_at`, { time: earliest });
  };

  const renderRow = (
    key: string,
    label: string,
    remain: number,
    size: number,
    percent: number | null,
    expiry: string | null,
    index: number
  ) => (
    <div className={classes.quotaRow} key={key}>
      <div className={classes.quotaRowHeader}>
        <span className={classes.quotaModel}>{label}</span>
        <div className={classes.quotaMeta}>
          <span className={classes.quotaPercent}>{percentLabel(percent)}</span>
          <span className={classes.quotaAmount}>
            {formatAmount(remain)} / {formatAmount(size, unit)}
          </span>
          {expiry && <span className={classes.quotaReset}>{expiry}</span>}
        </div>
      </div>
      <QuotaMeter percent={percent} classes={classes} index={index} />
    </div>
  );

  return (
    <>
      <div className={classes.quotaRow}>
        <div className={classes.quotaRowHeader}>
          <span className={classes.quotaModel}>{t(`${i18nPrefix}.total_label`)}</span>
          <div className={classes.quotaMeta}>
            <span className={classes.quotaPercent}>{percentLabel(remainingPercent)}</span>
            <span className={classes.quotaAmount}>
              {formatAmount(totalRemain)} / {formatAmount(totalSize, unit)}
            </span>
            <span className={classes.quotaReset}>{siteLabel}</span>
          </div>
        </div>
        <QuotaMeter percent={remainingPercent} classes={classes} />
      </div>
      {expanded && collapsible ? (
        <div id={listId} className={classes.quotaScroll}>
          {sorted.map((pkg, index) => {
            const cycleEnd = formatBuddyCycleEnd(pkg.cycleEnd);
            return renderRow(
              `pkg-${pkg.originalIndex}`,
              pkg.name || t(`${i18nPrefix}.package_fallback`, { index: pkg.originalIndex + 1 }),
              pkg.remain,
              pkg.size,
              pkg.remainingPercent,
              cycleEnd ? t(`${i18nPrefix}.expires_at`, { time: cycleEnd }) : null,
              index + 1
            );
          })}
        </div>
      ) : (
        visibleGroups.map((group, index) =>
          renderRow(
            group.key,
            groupLabel(group),
            group.remain,
            group.size,
            group.remainingPercent,
            groupExpiry(group),
            index + 1
          )
        )
      )}
      {collapsible && (
        <button
          type="button"
          className={classes.quotaToggle}
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded
            ? t('buddy_quota.collapse')
            : t('buddy_quota.show_all', { count: packages.length })}
          {expanded ? (
            <IconChevronUp size={12} aria-hidden="true" />
          ) : (
            <IconChevronDown size={12} aria-hidden="true" />
          )}
        </button>
      )}
      {packCount === 0 && (
        <div className={classes.quotaMessage}>{t(`${i18nPrefix}.empty_packages`)}</div>
      )}
    </>
  );
}

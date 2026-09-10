/** CodeBuddy credits renderer for the quota page and auth-file cards. */

import { useTranslation } from 'react-i18next';
import type { CodeBuddyQuotaState } from '@/types';
import { QuotaMeter } from '../../components/QuotaMeter';
import type { QuotaBodyProps } from '../../types';
import { readCodeBuddyQuotaView } from './data';

const formatAmount = (value: number, unit = ''): string => {
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
};

const formatCycleEnd = (value: string | null): string | null => {
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
};

export function CodeBuddyQuotaBody({ quota, classes }: QuotaBodyProps<CodeBuddyQuotaState>) {
  const { t } = useTranslation();
  const view = readCodeBuddyQuotaView(quota.usage ?? null);
  if (!view) {
    return <div className={classes.quotaMessage}>{t('codebuddy_quota.empty_data')}</div>;
  }

  const unit = t('codebuddy_quota.unit_default');
  const siteLabel =
    view.site === 'global'
      ? t('auth_login.codebuddy_region_global')
      : t('auth_login.codebuddy_region_cn');

  return (
    <>
      <div className={classes.quotaRow}>
        <div className={classes.quotaRowHeader}>
          <span className={classes.quotaModel}>{t('codebuddy_quota.total_label')}</span>
          <div className={classes.quotaMeta}>
            <span className={classes.quotaPercent}>
              {view.remainingPercent === null ? '--' : `${Math.round(view.remainingPercent)}%`}
            </span>
            <span className={classes.quotaAmount}>
              {formatAmount(view.totalRemain)} / {formatAmount(view.totalSize, unit)}
            </span>
            <span className={classes.quotaReset}>{siteLabel}</span>
          </div>
        </div>
        <QuotaMeter percent={view.remainingPercent} classes={classes} />
      </div>
      {view.packages.map((pkg, index) => {
        const label = pkg.name || t('codebuddy_quota.package_fallback', { index: index + 1 });
        const cycleEnd = formatCycleEnd(pkg.cycleEnd);
        return (
          <div className={classes.quotaRow} key={`${label}-${index}`}>
            <div className={classes.quotaRowHeader}>
              <span className={classes.quotaModel}>{label}</span>
              <div className={classes.quotaMeta}>
                <span className={classes.quotaPercent}>
                  {pkg.remainingPercent === null ? '--' : `${Math.round(pkg.remainingPercent)}%`}
                </span>
                <span className={classes.quotaAmount}>
                  {formatAmount(pkg.remain)} / {formatAmount(pkg.size, unit)}
                </span>
                {cycleEnd && (
                  <span className={classes.quotaReset}>
                    {t('codebuddy_quota.expires_at', { time: cycleEnd })}
                  </span>
                )}
              </div>
            </div>
            <QuotaMeter percent={pkg.remainingPercent} classes={classes} index={index + 1} />
          </div>
        );
      })}
      {view.packCount === 0 && (
        <div className={classes.quotaMessage}>{t('codebuddy_quota.empty_packages')}</div>
      )}
    </>
  );
}

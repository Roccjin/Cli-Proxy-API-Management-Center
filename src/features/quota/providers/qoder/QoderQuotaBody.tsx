/** Qoder quota snapshot renderer for both the quota page and auth-file cards. */

import { useTranslation } from 'react-i18next';
import type { QoderQuotaState } from '@/types';
import { normalizeNumberValue, normalizeStringValue } from '@/utils/quota';
import { QuotaMeter } from '../../components/QuotaMeter';
import type { QuotaBodyProps } from '../../types';
import { readQoderOrgBucket, readQoderUserBucket, type QoderQuotaBucketView } from './data';

const normalizeBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;
  return ['true', '1', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
};

const formatAmount = (value: number | null, unit = ''): string => {
  if (value === null) return '-';
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
};

const formatExpiry = (value: unknown): string | null => {
  const numeric = normalizeNumberValue(value);
  const date =
    numeric !== null && numeric > 0
      ? new Date(numeric < 1e12 ? numeric * 1000 : numeric)
      : typeof value === 'string'
        ? new Date(value)
        : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const bucketAmountLabel = (
  bucket: QoderQuotaBucketView,
  fallbackUnit: string,
  remainingText: (amount: string) => string
): string | null => {
  const unit = bucket.unit ?? fallbackUnit;
  if (bucket.used !== null && bucket.total !== null && bucket.total > 0) {
    return `${formatAmount(bucket.used)} / ${formatAmount(bucket.total, unit)}`;
  }
  if (bucket.remaining !== null) {
    return remainingText(formatAmount(bucket.remaining, unit));
  }
  if (bucket.used !== null) {
    return formatAmount(bucket.used, unit);
  }
  return null;
};

export function QoderQuotaBody({ quota, classes }: QuotaBodyProps<QoderQuotaState>) {
  const { t } = useTranslation();
  const usage = quota.usage ?? null;
  if (!usage) return <div className={classes.quotaMessage}>{t('qoder_quota.empty_data')}</div>;

  const fallbackUnit = normalizeStringValue(usage.unit) ?? t('qoder_quota.unit_default');
  const user = readQoderUserBucket(usage);
  const org = readQoderOrgBucket(usage);
  const expiry = formatExpiry(usage.expires_at ?? usage.expiresAt);
  const exceeded = normalizeBoolean(usage.is_quota_exceeded ?? usage.isQuotaExceeded);
  const remainingText = (amount: string) => t('qoder_quota.remaining_amount', { amount });

  const renderBucket = (label: string, bucket: QoderQuotaBucketView, showExpiry: boolean) => {
    const amountLabel = bucketAmountLabel(bucket, fallbackUnit, remainingText);
    return (
      <div className={classes.quotaRow}>
        <div className={classes.quotaRowHeader}>
          <span className={classes.quotaModel}>{label}</span>
          <div className={classes.quotaMeta}>
            <span className={classes.quotaPercent}>
              {bucket.remainingPercent === null ? '--' : `${Math.round(bucket.remainingPercent)}%`}
            </span>
            {amountLabel && <span className={classes.quotaAmount}>{amountLabel}</span>}
            {showExpiry && expiry && (
              <span className={classes.quotaReset}>
                {t('qoder_quota.expires_at', { time: expiry })}
              </span>
            )}
          </div>
        </div>
        <QuotaMeter percent={bucket.remainingPercent} classes={classes} />
      </div>
    );
  };

  return (
    <>
      {user && renderBucket(t('qoder_quota.personal_label'), user, true)}
      {org && renderBucket(t('qoder_quota.org_label'), org, !user)}
      {!user && !org && (
        <div className={classes.quotaMessage}>{t('qoder_quota.empty_data')}</div>
      )}
      {exceeded && (
        <div className={classes.quotaWarningMessage} role="alert">
          {t('qoder_quota.quota_exceeded')}
        </div>
      )}
    </>
  );
}

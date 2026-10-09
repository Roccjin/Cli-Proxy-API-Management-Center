/** CodeBuddy credits renderer for the quota page and auth-file cards. */

import { useTranslation } from 'react-i18next';
import type { CodeBuddyQuotaState } from '@/types';
import type { QuotaBodyProps } from '../../types';
import { BuddyCreditsBody } from '../buddy/BuddyCreditsBody';
import { readCodeBuddyQuotaView } from './data';

export function CodeBuddyQuotaBody({ quota, classes }: QuotaBodyProps<CodeBuddyQuotaState>) {
  const { t } = useTranslation();
  const view = readCodeBuddyQuotaView(quota.usage ?? null);
  if (!view) {
    return <div className={classes.quotaMessage}>{t('codebuddy_quota.empty_data')}</div>;
  }

  const siteLabel =
    view.site === 'global'
      ? t('auth_login.codebuddy_region_global')
      : t('auth_login.codebuddy_region_cn');

  return (
    <BuddyCreditsBody
      i18nPrefix="codebuddy_quota"
      siteLabel={siteLabel}
      totalRemain={view.totalRemain}
      totalSize={view.totalSize}
      remainingPercent={view.remainingPercent}
      packCount={view.packCount}
      packages={view.packages}
      classes={classes}
    />
  );
}

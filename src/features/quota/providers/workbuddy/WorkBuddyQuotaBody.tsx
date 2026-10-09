/** WorkBuddy credits renderer for the quota page and auth-file cards. */

import { useTranslation } from 'react-i18next';
import type { WorkBuddyQuotaState } from '@/types';
import type { QuotaBodyProps } from '../../types';
import { BuddyCreditsBody } from '../buddy/BuddyCreditsBody';
import { readWorkBuddyQuotaView } from './data';

export function WorkBuddyQuotaBody({ quota, classes }: QuotaBodyProps<WorkBuddyQuotaState>) {
  const { t } = useTranslation();
  const view = readWorkBuddyQuotaView(quota.usage ?? null);
  if (!view) {
    return <div className={classes.quotaMessage}>{t('workbuddy_quota.empty_data')}</div>;
  }

  const siteLabel =
    view.site === 'global'
      ? t('auth_login.workbuddy_region_global')
      : t('auth_login.workbuddy_region_cn');

  return (
    <BuddyCreditsBody
      i18nPrefix="workbuddy_quota"
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

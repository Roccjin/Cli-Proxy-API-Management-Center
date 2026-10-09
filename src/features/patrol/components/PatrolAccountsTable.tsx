import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { IconSearch } from '@/components/ui/icons';
import { ProviderTabs } from '@/features/authFiles/components/ProviderTabs';
import { getAuthFileIcon, getTypeLabel, type ResolvedTheme } from '@/features/authFiles/constants';
import {
  DEFAULT_PATROL_PAGE_SIZE,
  PATROL_ACCOUNT_FILTERS,
  PATROL_PAGE_SIZES,
  filterPatrolAccounts,
  isCreditsPatrolTarget,
  patrolResultTone,
  type PatrolAccountFilter,
} from '@/features/patrol/logic';
import type { PatrolAccount, PatrolKind, PatrolLastResult } from '@/features/patrol/types';
import { paginate } from '@/utils/pagination';
import { formatInstantShort, formatRelativeInstant } from '@/utils/quota';
import { parseTimestamp } from '@/utils/timestamp';
import styles from './PatrolAccountsTable.module.scss';

const ACCOUNT_TABS = ['all', 'codebuddy', 'workbuddy'];

type PatrolAccountsTableProps = {
  accounts: PatrolAccount[];
  loading: boolean;
  resolvedTheme: ResolvedTheme;
  now: number;
  locale?: string;
};

export function PatrolAccountsTable({
  accounts,
  loading,
  resolvedTheme,
  now,
  locale,
}: PatrolAccountsTableProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PatrolAccountFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PATROL_PAGE_SIZE);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: accounts.length, codebuddy: 0, workbuddy: 0 };
    accounts.forEach((account) => {
      counts[account.provider] = (counts[account.provider] ?? 0) + 1;
    });
    return counts;
  }, [accounts]);

  const filtered = useMemo(
    () => filterPatrolAccounts(accounts, { provider: tab, query, filter }),
    [accounts, filter, query, tab]
  );
  const { pageItems, currentPage, totalPages } = paginate(filtered, page, pageSize);

  const resetPage = () => setPage(1);

  const renderLast = (account: PatrolAccount, kind: PatrolKind) => {
    if (kind === 'activity' && !account.activityEligible) {
      return <span className={styles.muted}>{t('patrol.not_applicable')}</span>;
    }
    if (kind === 'webDaily' && !account.webDailyEligible) {
      return <span className={styles.muted}>{t('patrol.not_applicable')}</span>;
    }
    const last: PatrolLastResult | undefined =
      kind === 'credits'
        ? account.credits
        : kind === 'activity'
          ? account.activity
          : account.webDaily;
    if (!last?.result && !last?.at) {
      if (kind === 'credits') {
        if (isCreditsPatrolTarget(account)) {
          return <span className={styles.muted}>{t('patrol.credits_pending')}</span>;
        }
        return (
          <span className={styles.muted} title={t('patrol.credits_not_target_hint')}>
            {t('patrol.credits_not_target')}
          </span>
        );
      }
      return <span className={styles.muted}>{t('patrol.never')}</span>;
    }
    const tone = patrolResultTone(last.result);
    const resultKey = last.result
      ? kind === 'webDaily' && last.result === 'ok'
        ? 'patrol.result_web_ok'
        : `patrol.result_${last.result}`
      : '';
    const atMs = last.at ? parseTimestamp(last.at)?.getTime() : undefined;
    return (
      <div className={styles.last}>
        {last.result ? (
          <span className={`${styles.pill} ${styles[tone]}`}>{t(resultKey)}</span>
        ) : null}
        {kind === 'credits' && last.remain !== undefined ? (
          <span className={styles.remain}>{t('patrol.remain', { value: last.remain })}</span>
        ) : null}
        {atMs ? (
          <span className={styles.when} title={formatInstantShort(atMs)}>
            {formatRelativeInstant(atMs, now, locale)}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <section className={styles.accounts}>
      <div className={styles.accountsHead}>
        <h2 className={styles.accountsTitle}>{t('patrol.accounts_title')}</h2>
        <ProviderTabs
          types={ACCOUNT_TABS}
          counts={tabCounts}
          active={tab}
          resolvedTheme={resolvedTheme}
          onChange={(next) => {
            setTab(next);
            resetPage();
          }}
        />
      </div>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Input
            value={query}
            placeholder={t('patrol.search_placeholder')}
            aria-label={t('patrol.search_placeholder')}
            rightElement={<IconSearch size={16} />}
            onChange={(event) => {
              setQuery(event.target.value);
              resetPage();
            }}
          />
        </div>
        <div className={styles.filter}>
          <Select
            size="sm"
            value={filter}
            ariaLabel={t('patrol.filter_label')}
            options={PATROL_ACCOUNT_FILTERS.map((value) => ({
              value,
              label: t(`patrol.filter_${value}`),
            }))}
            onChange={(value) => {
              setFilter(value as PatrolAccountFilter);
              resetPage();
            }}
          />
        </div>
        <div className={styles.pageSize}>
          <Select
            size="sm"
            value={String(pageSize)}
            ariaLabel={t('auth_files.display_options_label')}
            options={PATROL_PAGE_SIZES.map((size) => ({
              value: String(size),
              label: t('patrol.page_size_option', { count: size }),
            }))}
            onChange={(value) => {
              setPageSize(Number(value));
              resetPage();
            }}
          />
        </div>
      </div>

      {loading && accounts.length === 0 ? (
        <Skeleton height={180} />
      ) : accounts.length === 0 ? (
        <EmptyState title={t('patrol.empty')} description={t('patrol.empty_desc')} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t('patrol.no_match')}
          description={t('patrol.no_match_desc')}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery('');
                setFilter('all');
                setTab('all');
                resetPage();
              }}
            >
              {t('auth_files.no_results_clear')}
            </Button>
          }
        />
      ) : (
        <Table
          cols={
            <>
              <col style={{ width: '36%' }} />
              <col style={{ width: '12%' }} />
              <col />
              <col />
              <col />
            </>
          }
        >
          <TableHeader>
            <TableRow>
              <TableHead>{t('patrol.col_account')}</TableHead>
              <TableHead>{t('patrol.col_status')}</TableHead>
              <TableHead>{t('patrol.col_credits')}</TableHead>
              <TableHead>{t('patrol.col_activity')}</TableHead>
              <TableHead>{t('patrol.col_web_daily')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((account) => {
              const icon = getAuthFileIcon(account.provider, resolvedTheme);
              const exhausted = account.disabledReason === 'credits_exhausted';
              return (
                <TableRow key={account.id || account.name}>
                  <TableCell>
                    <div className={styles.identity}>
                      {icon ? <img src={icon} alt="" className={styles.providerIcon} /> : null}
                      <div>
                        <div className={styles.email}>{account.email || account.name}</div>
                        <div className={styles.sub}>
                          {getTypeLabel(t, account.provider)}
                          {account.region ? ` · ${t(`patrol.region_${account.region}`)}` : ''}
                          {account.email ? ` · ${account.name}` : ''}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {account.disabled ? (
                      <span className={`${styles.pill} ${exhausted ? styles.warn : styles.bad}`}>
                        {exhausted
                          ? t('patrol.status_credits_exhausted')
                          : t('patrol.status_disabled')}
                      </span>
                    ) : (
                      <span className={`${styles.pill} ${styles.ok}`}>
                        {t('patrol.status_enabled')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{renderLast(account, 'credits')}</TableCell>
                  <TableCell>{renderLast(account, 'activity')}</TableCell>
                  <TableCell>{renderLast(account, 'webDaily')}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {filtered.length > pageSize && (
        <div className={styles.pagination}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            {t('auth_files.pagination_prev')}
          </Button>
          <div className={styles.pageInfo}>
            {t('patrol.pagination_info', {
              current: currentPage,
              total: totalPages,
              count: filtered.length,
            })}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            {t('auth_files.pagination_next')}
          </Button>
        </div>
      )}
    </section>
  );
}

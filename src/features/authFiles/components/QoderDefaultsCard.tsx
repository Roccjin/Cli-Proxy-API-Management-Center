import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { getAuthFileIcon } from '@/features/authFiles/constants';
import { useQoderDefaults } from '@/features/authFiles/hooks/useQoderDefaults';
import { countQoderOverrides, isQoderRowCustom } from '@/features/authFiles/qoderDefaultsLogic';
import { useThemeStore } from '@/stores';
import { QoderDefaultsSheet } from './QoderDefaultsSheet';
import panel from './OAuthConfigPanels.module.scss';
import styles from './QoderDefaults.module.scss';

const CHIP_LIMIT = 6;

export function QoderDefaultsCard({ disableControls }: { disableControls: boolean }) {
  const { t } = useTranslation();
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const { status, error, rows, saved, saving, reload, save } = useQoderDefaults();
  const [open, setOpen] = useState(false);
  const icon = getAuthFileIcon('qoder', resolvedTheme);
  const customCount = countQoderOverrides(saved);
  const hint = t('qoder_defaults.hint');

  const chips = useMemo(
    () =>
      rows
        .filter((row) => isQoderRowCustom(saved, row.key))
        .map((row) => {
          const current = saved[row.key] || {};
          const thinking =
            current.thinking === 'off' ? t('qoder_defaults.off') : current.thinking || '';
          const text = [row.displayName, thinking, current.context || '']
            .filter(Boolean)
            .join(' · ');
          return { key: row.key, text };
        }),
    [rows, saved, t]
  );

  return (
    <section className={panel.panel}>
      <header className={panel.panelHead}>
        <div className={styles.brand}>
          {icon ? <img className={styles.mark} src={icon} alt="" /> : null}
          <h3 className={panel.panelTitle}>{t('qoder_defaults.title')}</h3>
          {status === 'ready' && (
            <span className={styles.summary}>
              {t('qoder_defaults.summary_custom', { custom: customCount, total: rows.length })}
            </span>
          )}
        </div>
        {status !== 'unsupported' && (
          <div className={panel.panelExtra}>
            <Button
              size="sm"
              onClick={() => setOpen(true)}
              disabled={disableControls || status !== 'ready'}
            >
              {t('qoder_defaults.edit')}
            </Button>
          </div>
        )}
      </header>
      <p className={`${panel.panelHint} ${styles.hint}`} title={hint}>
        {hint}
      </p>
      {status === 'loading' && <div className={panel.empty}>{t('common.loading')}</div>}
      {status === 'unsupported' && (
        <div className={panel.empty}>{t('qoder_defaults.unsupported')}</div>
      )}
      {status === 'error' && (
        <div className={styles.statusRow}>
          <span>
            {t('qoder_defaults.load_failed')}
            {error ? `: ${error}` : ''}
          </span>
          <Button variant="secondary" size="sm" onClick={() => void reload()}>
            {t('common.refresh')}
          </Button>
        </div>
      )}
      {status === 'ready' &&
        (chips.length === 0 ? (
          <p className={styles.none}>{t('qoder_defaults.summary_none')}</p>
        ) : (
          <div className={styles.chips}>
            {chips.slice(0, CHIP_LIMIT).map((chip) => (
              <span key={chip.key} className={styles.chip} title={chip.key}>
                {chip.text}
              </span>
            ))}
            {chips.length > CHIP_LIMIT && (
              <span className={styles.more}>
                {t('qoder_defaults.more_count', { count: chips.length - CHIP_LIMIT })}
              </span>
            )}
          </div>
        ))}
      <QoderDefaultsSheet
        open={open}
        onClose={() => setOpen(false)}
        rows={rows}
        saved={saved}
        saving={saving}
        disableControls={disableControls}
        onSave={save}
      />
    </section>
  );
}

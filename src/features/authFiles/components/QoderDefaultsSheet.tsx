import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Sheet } from '@/components/ui/Sheet';
import { IconSearch } from '@/components/ui/icons';
import { QODER_CONTEXT_SIZES, type QoderCatalogModel } from '@/services/api/qoderDefaults';
import {
  QODER_INHERIT,
  applyQoderDefaultField,
  filterQoderRows,
  isQoderRowCustom,
  qoderContextValues,
  qoderDefaultsEqual,
  qoderThinkingValues,
  setQoderDefaultField,
  unionThinkingLevels,
  type QoderDefaults,
  type QoderField,
} from '@/features/authFiles/qoderDefaultsLogic';
import { useNotificationStore } from '@/stores';
import styles from './QoderDefaults.module.scss';

type QoderDefaultsSheetProps = {
  open: boolean;
  onClose: () => void;
  rows: readonly QoderCatalogModel[];
  saved: QoderDefaults;
  saving: boolean;
  disableControls: boolean;
  onSave: (next: QoderDefaults) => Promise<boolean>;
};

export function QoderDefaultsSheet({
  open,
  onClose,
  rows,
  saved,
  saving,
  disableControls,
  onSave,
}: QoderDefaultsSheetProps) {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const showConfirmation = useNotificationStore((state) => state.showConfirmation);
  const [draft, setDraft] = useState<QoderDefaults>(saved);
  const [query, setQuery] = useState('');
  const [onlyCustom, setOnlyCustom] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(saved);
      setQuery('');
      setOnlyCustom(false);
    }
    wasOpen.current = open;
  }, [open, saved]);

  const dirty = !qoderDefaultsEqual(draft, saved);
  const visibleRows = useMemo(
    () => filterQoderRows(rows, draft, query, onlyCustom),
    [draft, onlyCustom, query, rows]
  );
  const customCount = useMemo(
    () => rows.filter((row) => isQoderRowCustom(draft, row.key)).length,
    [draft, rows]
  );
  const thinkingLevels = useMemo(() => unionThinkingLevels(visibleRows), [visibleRows]);

  const confirmClose = useCallback((): boolean | Promise<boolean> => {
    if (!dirty || saving) return true;
    return new Promise<boolean>((resolve) => {
      showConfirmation({
        title: t('providersPage.unsavedChanges.title'),
        message: t('providersPage.unsavedChanges.message'),
        variant: 'danger',
        confirmText: t('providersPage.unsavedChanges.discard'),
        cancelText: t('providersPage.unsavedChanges.keepEditing'),
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, [dirty, saving, showConfirmation, t]);

  const handleCancel = useCallback(() => {
    void Promise.resolve(confirmClose()).then((ok) => {
      if (ok) onClose();
    });
  }, [confirmClose, onClose]);

  const updateField = (key: string, field: QoderField, value: string) => {
    const nextValue = value === QODER_INHERIT ? '' : value;
    setDraft((prev) => setQoderDefaultField(prev, key, field, nextValue));
  };

  const applyBatch = (field: QoderField, value: string) => {
    if (!value) return;
    const result = applyQoderDefaultField(draft, visibleRows, field, value);
    setDraft(result.next);
    if (result.skipped > 0) {
      showNotification(
        t('qoder_defaults.batch_applied_skipped', {
          count: result.applied,
          skipped: result.skipped,
        }),
        'success'
      );
      return;
    }
    showNotification(t('qoder_defaults.batch_applied', { count: result.applied }), 'success');
  };

  const resetRow = (key: string) => {
    setDraft((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = async () => {
    const ok = await onSave(draft);
    if (ok) onClose();
  };

  const inheritOption = (label: string) => ({ value: QODER_INHERIT, label });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      confirmClose={confirmClose}
      eyebrow={t('qoder_defaults.sheet_eyebrow')}
      title={t('qoder_defaults.sheet_title')}
      description={t('qoder_defaults.hint')}
      footer={
        <div className={styles.footer}>
          <Button variant="secondary" size="sm" onClick={handleCancel} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            loading={saving}
            disabled={!dirty || saving || disableControls}
          >
            {t('qoder_defaults.save')}
          </Button>
        </div>
      }
    >
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Input
            value={query}
            placeholder={t('qoder_defaults.search_placeholder')}
            aria-label={t('qoder_defaults.search_placeholder')}
            rightElement={<IconSearch size={16} />}
            onChange={(event) => setQuery(event.target.value)}
            disabled={disableControls}
          />
        </div>
        <div className={styles.segmented} role="group">
          <button
            type="button"
            className={`${styles.segment} ${onlyCustom ? '' : styles.segmentActive}`}
            onClick={() => setOnlyCustom(false)}
          >
            {t('qoder_defaults.filter_all', { count: rows.length })}
          </button>
          <button
            type="button"
            className={`${styles.segment} ${onlyCustom ? styles.segmentActive : ''}`}
            onClick={() => setOnlyCustom(true)}
          >
            {t('qoder_defaults.filter_custom', { count: customCount })}
          </button>
        </div>
      </div>

      <div className={styles.batch}>
        <span className={styles.batchLabel}>
          {t('qoder_defaults.batch_label', { count: visibleRows.length })}
        </span>
        <div className={styles.batchSelect}>
          <Select
            size="sm"
            fullWidth
            value=""
            placeholder={t('qoder_defaults.batch_thinking')}
            ariaLabel={t('qoder_defaults.batch_thinking')}
            disabled={disableControls || visibleRows.length === 0}
            options={[
              inheritOption(t('qoder_defaults.model_default')),
              { value: 'off', label: t('qoder_defaults.off') },
              ...thinkingLevels.map((level) => ({ value: level, label: level })),
            ]}
            onChange={(value) => applyBatch('thinking', value)}
          />
        </div>
        <div className={styles.batchSelect}>
          <Select
            size="sm"
            fullWidth
            value=""
            placeholder={t('qoder_defaults.batch_context')}
            ariaLabel={t('qoder_defaults.batch_context')}
            disabled={disableControls || visibleRows.length === 0}
            options={[
              inheritOption(t('qoder_defaults.model_default')),
              ...QODER_CONTEXT_SIZES.map((size) => ({ value: size, label: size })),
            ]}
            onChange={(value) => applyBatch('context', value)}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={disableControls}
          onClick={() => setDraft({})}
        >
          {t('qoder_defaults.clear_all')}
        </Button>
      </div>

      {visibleRows.length === 0 ? (
        <p className={styles.empty}>{t('qoder_defaults.no_match')}</p>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.table}>
            <div className={styles.head}>
              <span>{t('qoder_defaults.col_model')}</span>
              <span>{t('qoder_defaults.thinking')}</span>
              <span>{t('qoder_defaults.context')}</span>
              <span />
            </div>
            {visibleRows.map((row) => {
              const current = draft[row.key] || {};
              const custom = isQoderRowCustom(draft, row.key);
              const thinkingValues = qoderThinkingValues(row);
              const thinkingUnsupported = thinkingValues.length === 0;
              const contextLabel = row.catalogContext
                ? t('qoder_defaults.catalog_default', { size: row.catalogContext })
                : t('qoder_defaults.model_default');
              return (
                <div
                  key={row.key}
                  className={`${styles.modelRow} ${custom ? styles.modelRowCustom : ''}`}
                >
                  <div className={styles.modelMain}>
                    <span className={styles.modelName}>{row.displayName}</span>
                    <span className={styles.modelKey}>{row.key}</span>
                  </div>
                  <Select
                    size="sm"
                    fullWidth
                    value={current.thinking || QODER_INHERIT}
                    disabled={disableControls || thinkingUnsupported}
                    ariaLabel={t('qoder_defaults.thinking')}
                    options={[
                      {
                        value: QODER_INHERIT,
                        label: thinkingUnsupported
                          ? t('qoder_defaults.not_supported')
                          : t('qoder_defaults.model_default'),
                      },
                      ...thinkingValues.map((level) => ({
                        value: level,
                        label: level === 'off' ? t('qoder_defaults.off') : level,
                      })),
                    ]}
                    onChange={(value) => updateField(row.key, 'thinking', value)}
                  />
                  <Select
                    size="sm"
                    fullWidth
                    value={current.context || QODER_INHERIT}
                    disabled={disableControls}
                    ariaLabel={t('qoder_defaults.context')}
                    options={[
                      inheritOption(contextLabel),
                      ...qoderContextValues(row).map((size) => ({ value: size, label: size })),
                    ]}
                    onChange={(value) => updateField(row.key, 'context', value)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className={custom ? '' : styles.resetHidden}
                    aria-label={t('qoder_defaults.reset_row')}
                    disabled={!custom || disableControls}
                    onClick={() => resetRow(row.key)}
                  >
                    ↺
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Sheet>
  );
}

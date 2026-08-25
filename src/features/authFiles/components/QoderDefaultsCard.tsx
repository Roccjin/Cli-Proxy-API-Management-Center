import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useAuthStore, useModelsStore, useNotificationStore } from '@/stores';
import { useApiKeysForModels } from '@/hooks/useApiKeysForModels';
import {
  QODER_CONTEXT_SIZES,
  catalogFromV1Models,
  fallbackQoderCatalog,
  mergeCatalogWithDefaults,
  qoderDefaultsApi,
  type QoderCatalogModel,
  type QoderModelDefault,
} from '@/services/api/qoderDefaults';
import { getErrorMessage, isRecord } from '@/utils/helpers';
import styles from './OAuthConfigPanels.module.scss';

export function QoderDefaultsCard({ disableControls }: { disableControls: boolean }) {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const apiBase = useAuthStore((state) => state.apiBase);
  const fetchModels = useModelsStore((state) => state.fetchModels);
  const resolveApiKeys = useApiKeysForModels();

  const [defaults, setDefaults] = useState<Record<string, QoderModelDefault>>({});
  const [catalog, setCatalog] = useState<QoderCatalogModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const rows = useMemo(
    () => mergeCatalogWithDefaults(catalog, defaults),
    [catalog, defaults]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setUnsupported(false);
    try {
      setDefaults(await qoderDefaultsApi.get());
    } catch (err: unknown) {
      const status = isRecord(err) && typeof err.status === 'number' ? err.status : undefined;
      if (status === 404) {
        setUnsupported(true);
        setLoading(false);
        return;
      }
      showNotification(`${t('qoder_defaults.save_failed')}: ${getErrorMessage(err)}`, 'error');
    }

    try {
      const nextCatalog = await qoderDefaultsApi.listModels();
      if (nextCatalog.length > 0) {
        setCatalog(nextCatalog);
        setLoading(false);
        return;
      }
    } catch (err: unknown) {
      const status = isRecord(err) && typeof err.status === 'number' ? err.status : undefined;
      if (status === 404) {
        // Older CPA builds only have /qoder-model-defaults; fall through to /v1/models.
      }
    }

    try {
      const keys = await resolveApiKeys({ force: false });
      if (apiBase) {
        const list = await fetchModels(apiBase, keys[0], false);
        const fromV1 = catalogFromV1Models(list);
        if (fromV1.length > 0) {
          setCatalog(fromV1);
          setLoading(false);
          return;
        }
      }
    } catch {
      const cached = useModelsStore.getState().models;
      if (cached.length > 0) {
        const fromV1 = catalogFromV1Models(cached);
        if (fromV1.length > 0) {
          setCatalog(fromV1);
          setLoading(false);
          return;
        }
      }
    }
    setCatalog(fallbackQoderCatalog());
    setLoading(false);
  }, [apiBase, fetchModels, resolveApiKeys, showNotification, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRow = (key: string, field: 'thinking' | 'context', value: string) => {
    setDefaults((prev) => {
      const current = { ...(prev[key] || {}) };
      if (!value) {
        delete current[field];
      } else {
        current[field] = value;
      }
      const next = { ...prev };
      if (!current.thinking && !current.context) {
        delete next[key];
      } else {
        next[key] = current;
      }
      return next;
    });
  };

  const applyContextToAll = (value: string) => {
    if (!value) return;
    setDefaults((prev) => {
      const next = { ...prev };
      rows.forEach((row) => {
        const current = { ...(next[row.key] || {}) };
        current.context = value;
        next[row.key] = current;
      });
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await qoderDefaultsApi.put(defaults);
      showNotification(t('qoder_defaults.save_success'), 'success');
    } catch (err: unknown) {
      showNotification(`${t('qoder_defaults.save_failed')}: ${getErrorMessage(err)}`, 'error');
    }
    setSaving(false);
  };

  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <h3 className={styles.panelTitle}>{t('qoder_defaults.title')}</h3>
        <div className={styles.panelExtra}>
          <label className={styles.field}>
            <span>{t('qoder_defaults.apply_all_context')}</span>
            <select
              value=""
              disabled={disableControls || unsupported || loading || rows.length === 0}
              onChange={(event) => applyContextToAll(event.target.value)}
            >
              <option value="">{t('qoder_defaults.apply_all_placeholder')}</option>
              {QODER_CONTEXT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void load()}
            disabled={disableControls || loading}
          >
            {t('common.refresh', { defaultValue: 'Refresh' })}
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            loading={saving}
            disabled={disableControls || unsupported || loading}
          >
            {t('qoder_defaults.save')}
          </Button>
        </div>
      </header>
      <p className={styles.panelHint}>{t('qoder_defaults.hint')}</p>
      {unsupported ? (
        <div className={styles.empty}>{t('qoder_defaults.unsupported')}</div>
      ) : rows.length === 0 ? (
        <div className={styles.empty}>{t('qoder_defaults.empty')}</div>
      ) : (
        <div className={styles.list}>
          {rows.map((row) => {
            const current = defaults[row.key] || {};
            const efforts = row.thinkingLevels;
            const contexts = row.contextSizes.length ? row.contextSizes : [...QODER_CONTEXT_SIZES];
            const emptyContextLabel = row.catalogContext
              ? t('qoder_defaults.catalog_default', { size: row.catalogContext })
              : t('qoder_defaults.model_default');
            return (
              <div key={row.key} className={styles.row}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>{row.displayName}</div>
                  <div className={styles.rowMeta}>{row.key}</div>
                </div>
                <label className={styles.field}>
                  <span>{t('qoder_defaults.thinking')}</span>
                  <select
                    value={current.thinking || ''}
                    disabled={disableControls}
                    onChange={(event) => updateRow(row.key, 'thinking', event.target.value)}
                  >
                    <option value="">{t('qoder_defaults.model_default')}</option>
                    {row.zeroAllowed || efforts.length > 0 ? (
                      <option value="off">{t('qoder_defaults.off')}</option>
                    ) : null}
                    {efforts.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>{t('qoder_defaults.context')}</span>
                  <select
                    value={current.context || ''}
                    disabled={disableControls}
                    onChange={(event) => updateRow(row.key, 'context', event.target.value)}
                  >
                    <option value="">{emptyContextLabel}</option>
                    {contexts.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

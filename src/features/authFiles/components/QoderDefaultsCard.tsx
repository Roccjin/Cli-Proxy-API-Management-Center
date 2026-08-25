import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { useAuthStore, useModelsStore, useNotificationStore } from '@/stores';
import { useApiKeysForModels } from '@/hooks/useApiKeysForModels';
import { qoderDefaultsApi, type QoderModelDefault } from '@/services/api/qoderDefaults';
import { getErrorMessage, isRecord } from '@/utils/helpers';
import type { ModelInfo } from '@/utils/models';
import styles from './OAuthConfigPanels.module.scss';

const upstreamKey = (id: string) => id.replace(/^qoder\//i, '').trim();

const isQoderModel = (model: ModelInfo) => {
  if ((model.type || '').toLowerCase() === 'qoder') return true;
  return /^qoder\//i.test(model.name) || /qoder/i.test(model.alias || '');
};

const thinkingOptions = (model: ModelInfo): string[] => {
  const thinking = model.thinking;
  if (!isRecord(thinking) || !Array.isArray(thinking.levels)) return [];
  return thinking.levels
    .filter((level): level is string => typeof level === 'string' && level.trim() !== '')
    .map((level) => level.trim());
};

const contextOptions = (model: ModelInfo): string[] => {
  const cfg = model.contextConfig;
  if (!isRecord(cfg)) return [];
  return Object.keys(cfg).filter(Boolean);
};

const zeroAllowed = (model: ModelInfo) =>
  isRecord(model.thinking) && model.thinking.zero_allowed === true;

export function QoderDefaultsCard({ disableControls }: { disableControls: boolean }) {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const apiBase = useAuthStore((state) => state.apiBase);
  const models = useModelsStore((state) => state.models);
  const fetchModels = useModelsStore((state) => state.fetchModels);
  const resolveApiKeys = useApiKeysForModels();

  const [defaults, setDefaults] = useState<Record<string, QoderModelDefault>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const qoderModels = useMemo(
    () => models.filter(isQoderModel),
    [models]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setUnsupported(false);
    try {
      const next = await qoderDefaultsApi.get();
      setDefaults(next);
    } catch (err: unknown) {
      const status = isRecord(err) && typeof err.status === 'number' ? err.status : undefined;
      if (status === 404) {
        setUnsupported(true);
      } else {
        showNotification(`${t('qoder_defaults.save_failed')}: ${getErrorMessage(err)}`, 'error');
      }
    }
    try {
      const keys = await resolveApiKeys({ force: false });
      if (apiBase) {
        await fetchModels(apiBase, keys[0], false);
      }
    } catch {
      // model catalog is optional; defaults can still be edited by key
    }
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
      ) : qoderModels.length === 0 ? (
        <div className={styles.empty}>{t('qoder_defaults.empty')}</div>
      ) : (
        <div className={styles.list}>
          {qoderModels.map((model) => {
            const key = upstreamKey(model.name);
            const row = defaults[key] || {};
            const efforts = thinkingOptions(model);
            const contexts = contextOptions(model);
            return (
              <div key={model.name} className={styles.row}>
                <div className={styles.rowMain}>
                  <div className={styles.rowTitle}>{model.alias || model.name}</div>
                  <div className={styles.rowMeta}>{key}</div>
                </div>
                <label className={styles.field}>
                  <span>{t('qoder_defaults.thinking')}</span>
                  <select
                    value={row.thinking || ''}
                    disabled={disableControls}
                    onChange={(event) => updateRow(key, 'thinking', event.target.value)}
                  >
                    <option value="">{t('qoder_defaults.model_default')}</option>
                    {zeroAllowed(model) || efforts.length > 0 ? (
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
                    value={row.context || ''}
                    disabled={disableControls}
                    onChange={(event) => updateRow(key, 'context', event.target.value)}
                  >
                    <option value="">{t('qoder_defaults.model_default')}</option>
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

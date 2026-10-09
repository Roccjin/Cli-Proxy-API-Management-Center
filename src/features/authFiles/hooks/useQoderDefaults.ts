import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiKeysForModels } from '@/hooks/useApiKeysForModels';
import {
  catalogFromV1Models,
  fallbackQoderCatalog,
  mergeCatalogWithDefaults,
  qoderDefaultsApi,
  type QoderCatalogModel,
} from '@/services/api/qoderDefaults';
import { useAuthStore, useModelsStore, useNotificationStore } from '@/stores';
import { getErrorMessage, isRecord } from '@/utils/helpers';
import type { QoderDefaults } from '@/features/authFiles/qoderDefaultsLogic';

export type QoderDefaultsStatus = 'loading' | 'ready' | 'unsupported' | 'error';

const statusCode = (err: unknown): number | undefined =>
  isRecord(err) && typeof err.status === 'number' ? err.status : undefined;

export function useQoderDefaults(): {
  status: QoderDefaultsStatus;
  error: string;
  rows: QoderCatalogModel[];
  saved: QoderDefaults;
  saving: boolean;
  reload: () => Promise<void>;
  save: (next: QoderDefaults) => Promise<boolean>;
} {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const apiBase = useAuthStore((state) => state.apiBase);
  const fetchModels = useModelsStore((state) => state.fetchModels);
  const resolveApiKeys = useApiKeysForModels();

  const [status, setStatus] = useState<QoderDefaultsStatus>('loading');
  const [error, setError] = useState('');
  const [catalog, setCatalog] = useState<QoderCatalogModel[]>([]);
  const [saved, setSaved] = useState<QoderDefaults>({});
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => mergeCatalogWithDefaults(catalog, saved), [catalog, saved]);

  const reload = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      setSaved(await qoderDefaultsApi.get());
    } catch (err: unknown) {
      if (statusCode(err) === 404) {
        setStatus('unsupported');
        return;
      }
      setError(getErrorMessage(err));
      setStatus('error');
      return;
    }

    try {
      const nextCatalog = await qoderDefaultsApi.listModels();
      if (nextCatalog.length > 0) {
        setCatalog(nextCatalog);
        setStatus('ready');
        return;
      }
    } catch (err: unknown) {
      if (statusCode(err) === 404) {
        // Older CPA builds only have /qoder-model-defaults.
      }
    }

    try {
      const keys = await resolveApiKeys({ force: false });
      if (apiBase) {
        const list = await fetchModels(apiBase, keys[0], false);
        const fromV1 = catalogFromV1Models(list);
        if (fromV1.length > 0) {
          setCatalog(fromV1);
          setStatus('ready');
          return;
        }
      }
    } catch {
      const cached = useModelsStore.getState().models;
      if (cached.length > 0) {
        const fromV1 = catalogFromV1Models(cached);
        if (fromV1.length > 0) {
          setCatalog(fromV1);
          setStatus('ready');
          return;
        }
      }
    }
    setCatalog(fallbackQoderCatalog());
    setStatus('ready');
  }, [apiBase, fetchModels, resolveApiKeys]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (next: QoderDefaults) => {
      setSaving(true);
      try {
        await qoderDefaultsApi.put(next);
        setSaved(next);
        showNotification(t('qoder_defaults.save_success'), 'success');
        return true;
      } catch (err: unknown) {
        showNotification(`${t('qoder_defaults.save_failed')}: ${getErrorMessage(err)}`, 'error');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [showNotification, t]
  );

  return { status, error, rows, saved, saving, reload, save };
}

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFilesApi } from '@/services/api';
import { useNotificationStore } from '@/stores';
import type { AuthFileItem } from '@/types';
import type { AuthFileModelItem } from '@/features/authFiles/constants';
import { supportsAuthFileModelsRefresh } from '@/features/authFiles/constants';

type ModelsError = 'unsupported' | null;

export type UseAuthFilesModelsResult = {
  modelsModalOpen: boolean;
  modelsLoading: boolean;
  modelsRefreshing: boolean;
  modelsList: AuthFileModelItem[];
  modelsFileName: string;
  modelsFileType: string;
  modelsCanRefresh: boolean;
  modelsError: ModelsError;
  showModels: (item: AuthFileItem) => Promise<void>;
  refreshModels: () => Promise<void>;
  closeModelsModal: () => void;
  /** 文件集变更后失效缓存；不传 names 则全部清空。 */
  invalidateModels: (names?: string[]) => void;
};

export function useAuthFilesModels(): UseAuthFilesModelsResult {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);

  const [modelsModalOpen, setModelsModalOpen] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsRefreshing, setModelsRefreshing] = useState(false);
  const [modelsList, setModelsList] = useState<AuthFileModelItem[]>([]);
  const [modelsFile, setModelsFile] = useState<AuthFileItem | null>(null);
  const [modelsError, setModelsError] = useState<ModelsError>(null);
  const modelsCacheRef = useRef<Map<string, AuthFileModelItem[]>>(new Map());
  const modelsCacheVersionRef = useRef(0);
  const modelsFileVersionRef = useRef<Map<string, number>>(new Map());
  const activeModelsRequestIdRef = useRef(0);
  const modelsRefreshingRef = useRef(false);

  const closeModelsModal = useCallback(() => {
    activeModelsRequestIdRef.current += 1;
    setModelsModalOpen(false);
    setModelsLoading(false);
    setModelsRefreshing(false);
    modelsRefreshingRef.current = false;
  }, []);

  const invalidateModels = useCallback((names?: string[]) => {
    if (!names) {
      modelsCacheRef.current.clear();
      modelsFileVersionRef.current.clear();
      modelsCacheVersionRef.current += 1;
      return;
    }
    new Set(names.map((name) => name.trim()).filter(Boolean)).forEach((name) => {
      modelsCacheRef.current.delete(name);
      modelsFileVersionRef.current.set(name, (modelsFileVersionRef.current.get(name) ?? 0) + 1);
    });
  }, []);

  const showModels = useCallback(
    async (item: AuthFileItem) => {
      const cacheKey = item.name.trim();
      const requestId = ++activeModelsRequestIdRef.current;

      setModelsFile(item);
      setModelsList([]);
      setModelsError(null);
      setModelsModalOpen(true);

      const cached = modelsCacheRef.current.get(cacheKey);
      if (cached) {
        setModelsList(cached);
        setModelsLoading(false);
        return;
      }

      const cacheVersion = modelsCacheVersionRef.current;
      const fileVersion = modelsFileVersionRef.current.get(cacheKey) ?? 0;
      const isCacheCurrent = () =>
        cacheVersion === modelsCacheVersionRef.current &&
        fileVersion === (modelsFileVersionRef.current.get(cacheKey) ?? 0);
      const isRequestCurrent = () => requestId === activeModelsRequestIdRef.current;

      setModelsLoading(true);
      try {
        const models = await authFilesApi.getModelsForAuthFile(item.name, item.authIndex);
        if (isCacheCurrent()) {
          modelsCacheRef.current.set(cacheKey, models);
          if (isRequestCurrent()) setModelsList(models);
        }
      } catch (err) {
        if (!isRequestCurrent() || !isCacheCurrent()) return;
        const errorMessage = err instanceof Error ? err.message : '';
        if (
          errorMessage.includes('404') ||
          errorMessage.includes('not found') ||
          errorMessage.includes('Not Found')
        ) {
          setModelsError('unsupported');
        } else {
          showNotification(`${t('notification.load_failed')}: ${errorMessage}`, 'error');
        }
      } finally {
        if (isRequestCurrent()) setModelsLoading(false);
      }
    },
    [showNotification, t]
  );

  const refreshModels = useCallback(async () => {
    const item = modelsFile;
    if (!item || modelsRefreshingRef.current) return;
    if (!supportsAuthFileModelsRefresh(item.type || item.provider)) return;

    const cacheKey = item.name.trim();
    const requestId = ++activeModelsRequestIdRef.current;
    modelsRefreshingRef.current = true;
    setModelsRefreshing(true);
    setModelsError(null);

    try {
      const models = await authFilesApi.refreshModelsForAuthFile(item.name, item.authIndex);
      modelsCacheRef.current.set(cacheKey, models);
      if (requestId === activeModelsRequestIdRef.current) {
        setModelsList(models);
        showNotification(
          t('auth_files.models_refresh_success', { name: item.name, count: models.length }),
          'success'
        );
      }
    } catch (err) {
      if (requestId !== activeModelsRequestIdRef.current) return;
      const message = err instanceof Error ? err.message : t('common.unknown_error');
      showNotification(t('auth_files.models_refresh_failed', { name: item.name, message }), 'error');
    } finally {
      if (requestId === activeModelsRequestIdRef.current) {
        setModelsRefreshing(false);
        modelsRefreshingRef.current = false;
      }
    }
  }, [modelsFile, showNotification, t]);

  return {
    modelsModalOpen,
    modelsLoading,
    modelsRefreshing,
    modelsList,
    modelsFileName: modelsFile?.name ?? '',
    modelsFileType: modelsFile?.type || '',
    modelsCanRefresh: supportsAuthFileModelsRefresh(modelsFile?.type || modelsFile?.provider),
    modelsError,
    showModels,
    refreshModels,
    closeModelsModal,
    invalidateModels,
  };
}

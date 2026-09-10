/**
 * OAuth 与设备码登录相关 API
 */

import { apiClient } from './client';
import {
  isManagementOAuthProviderKey,
  normalizeManagementOAuthProviderKey,
} from '@/utils/providerKeys';

export type BuiltInOAuthProvider =
  | 'codex'
  | 'anthropic'
  | 'antigravity'
  | 'kimi'
  | 'qoder'
  | 'xai'
  | 'codebuddy'
  | 'workbuddy';

export interface OAuthStartResponse {
  url: string;
  state?: string;
}

export interface OAuthCallbackResponse {
  status: 'ok';
}

const WEBUI_SUPPORTED = new Set<string>(['codex', 'anthropic', 'antigravity', 'qoder', 'xai']);

const normalizeProviderForManagementPath = (provider: string): string => {
  const key = normalizeManagementOAuthProviderKey(provider);
  if (!isManagementOAuthProviderKey(key)) {
    throw new Error('Invalid OAuth provider');
  }
  return key;
};

export const buildOAuthStartParams = (
  provider: string,
  extra?: Record<string, string>
): Record<string, string | boolean> | undefined => {
  const providerKey = normalizeProviderForManagementPath(provider);
  const params: Record<string, string | boolean> = {};
  if (extra) {
    Object.entries(extra).forEach(([key, value]) => {
      const trimmed = value.trim();
      if (trimmed) params[key] = trimmed;
    });
  }
  if (WEBUI_SUPPORTED.has(providerKey)) {
    params.is_webui = true;
  }
  return Object.keys(params).length ? params : undefined;
};

export const oauthApi = {
  startAuth: (provider: string, extra?: Record<string, string>) => {
    const providerKey = normalizeProviderForManagementPath(provider);
    return apiClient.get<OAuthStartResponse>(`/${providerKey}-auth-url`, {
      params: buildOAuthStartParams(providerKey, extra),
    });
  },

  getAuthStatus: (state: string) =>
    apiClient.get<{ status: 'ok' | 'wait' | 'error'; error?: string }>(`/get-auth-status`, {
      params: { state },
    }),

  submitCallback: (provider: string, redirectUrl: string) => {
    const providerKey = normalizeProviderForManagementPath(provider);
    return apiClient.post<OAuthCallbackResponse>('/oauth-callback', {
      provider: providerKey,
      redirect_url: redirectUrl,
    });
  },

  submitQoderPAT: (pat: string) =>
    apiClient.post<{ status: string; email?: string; name?: string; error?: string }>(
      '/qoder-auth-url',
      { pat }
    ),
};

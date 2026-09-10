import { describe, expect, test } from 'bun:test';
import { buildOAuthStartParams } from '../src/services/api/oauth';
import {
  isCodeBuddyGlobalDomain,
  normalizeCodeBuddySite,
  resolveCodeBuddySite,
} from '../src/utils/codebuddy';

describe('normalizeCodeBuddySite', () => {
  test('defaults empty values to the international site', () => {
    expect(normalizeCodeBuddySite(undefined)).toBe('global');
    expect(normalizeCodeBuddySite('')).toBe('global');
    expect(normalizeCodeBuddySite('GLOBAL')).toBe('global');
  });

  test('accepts china aliases', () => {
    expect(normalizeCodeBuddySite('cn')).toBe('cn');
    expect(normalizeCodeBuddySite('China')).toBe('cn');
  });
});

describe('isCodeBuddyGlobalDomain', () => {
  test('detects the current international host', () => {
    expect(isCodeBuddyGlobalDomain('www.codebuddy.ai')).toBe(true);
    expect(isCodeBuddyGlobalDomain('https://www.codebuddy.ai/login')).toBe(true);
    expect(isCodeBuddyGlobalDomain('www.workbuddy.ai')).toBe(false);
  });

  test('treats china and empty domains as not global', () => {
    expect(isCodeBuddyGlobalDomain('')).toBe(false);
    expect(isCodeBuddyGlobalDomain('www.codebuddy.cn')).toBe(false);
    expect(isCodeBuddyGlobalDomain('copilot.tencent.com')).toBe(false);
  });
});

describe('resolveCodeBuddySite', () => {
  test('returns null for other providers', () => {
    expect(resolveCodeBuddySite({ type: 'kimi', domain: 'www.codebuddy.ai' })).toBeNull();
  });

  test('prefers the stored region field', () => {
    expect(
      resolveCodeBuddySite({
        type: 'codebuddy',
        region: 'global',
        domain: 'www.codebuddy.cn',
      })
    ).toBe('global');
  });

  test('falls back to domain and treats legacy china files as cn', () => {
    expect(resolveCodeBuddySite({ type: 'codebuddy', domain: 'www.codebuddy.ai' })).toBe('global');
    expect(resolveCodeBuddySite({ provider: 'codebuddy' })).toBe('cn');
  });
});

describe('buildOAuthStartParams', () => {
  test('sends the CodeBuddy region without enabling webui callbacks', () => {
    expect(buildOAuthStartParams('codebuddy', { region: 'global' })).toEqual({ region: 'global' });
    expect(buildOAuthStartParams('codebuddy', { region: 'cn' })).toEqual({ region: 'cn' });
  });

  test('keeps existing webui providers unchanged', () => {
    expect(buildOAuthStartParams('qoder')).toEqual({ is_webui: true });
  });
});

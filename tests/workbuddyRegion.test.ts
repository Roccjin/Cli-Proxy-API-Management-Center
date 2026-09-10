import { describe, expect, test } from 'bun:test';
import { buildOAuthStartParams } from '../src/services/api/oauth';
import {
  isWorkBuddyGlobalDomain,
  normalizeWorkBuddySite,
  resolveWorkBuddySite,
} from '../src/utils/workbuddy';

describe('normalizeWorkBuddySite', () => {
  test('defaults empty values to the international site', () => {
    expect(normalizeWorkBuddySite(undefined)).toBe('global');
    expect(normalizeWorkBuddySite('')).toBe('global');
    expect(normalizeWorkBuddySite('GLOBAL')).toBe('global');
  });

  test('accepts china aliases', () => {
    expect(normalizeWorkBuddySite('cn')).toBe('cn');
    expect(normalizeWorkBuddySite('China')).toBe('cn');
  });
});

describe('isWorkBuddyGlobalDomain', () => {
  test('detects the international host only', () => {
    expect(isWorkBuddyGlobalDomain('www.workbuddy.ai')).toBe(true);
    expect(isWorkBuddyGlobalDomain('https://www.workbuddy.ai/login')).toBe(true);
    expect(isWorkBuddyGlobalDomain('www.workbuddy.cn')).toBe(false);
    expect(isWorkBuddyGlobalDomain('www.codebuddy.ai')).toBe(false);
  });
});

describe('resolveWorkBuddySite', () => {
  test('returns null for other providers', () => {
    expect(resolveWorkBuddySite({ type: 'codebuddy', domain: 'www.workbuddy.ai' })).toBeNull();
  });

  test('falls back to domain', () => {
    expect(resolveWorkBuddySite({ type: 'workbuddy', domain: 'www.workbuddy.ai' })).toBe('global');
    expect(resolveWorkBuddySite({ type: 'workbuddy', domain: 'www.workbuddy.cn' })).toBe('cn');
    expect(resolveWorkBuddySite({ provider: 'workbuddy' })).toBe('cn');
  });
});

describe('buildOAuthStartParams', () => {
  test('sends the WorkBuddy region without enabling webui callbacks', () => {
    expect(buildOAuthStartParams('workbuddy', { region: 'global' })).toEqual({ region: 'global' });
    expect(buildOAuthStartParams('workbuddy', { region: 'cn' })).toEqual({ region: 'cn' });
  });
});

import { describe, expect, test } from 'bun:test';
import { supportsAuthFileModelsRefresh } from '../src/features/authFiles/constants';

describe('supportsAuthFileModelsRefresh', () => {
  test('allows qoder, codebuddy and workbuddy', () => {
    expect(supportsAuthFileModelsRefresh('qoder')).toBe(true);
    expect(supportsAuthFileModelsRefresh('CodeBuddy')).toBe(true);
    expect(supportsAuthFileModelsRefresh('WorkBuddy')).toBe(true);
  });

  test('rejects other providers', () => {
    expect(supportsAuthFileModelsRefresh('codex')).toBe(false);
    expect(supportsAuthFileModelsRefresh('claude')).toBe(false);
    expect(supportsAuthFileModelsRefresh('')).toBe(false);
  });
});

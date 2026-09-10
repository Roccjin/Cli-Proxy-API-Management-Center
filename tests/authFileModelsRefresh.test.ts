import { describe, expect, test } from 'bun:test';
import { supportsAuthFileModelsRefresh } from '../src/features/authFiles/constants';

describe('supportsAuthFileModelsRefresh', () => {
  test('allows qoder and codebuddy', () => {
    expect(supportsAuthFileModelsRefresh('qoder')).toBe(true);
    expect(supportsAuthFileModelsRefresh('CodeBuddy')).toBe(true);
  });

  test('rejects other providers', () => {
    expect(supportsAuthFileModelsRefresh('codex')).toBe(false);
    expect(supportsAuthFileModelsRefresh('claude')).toBe(false);
    expect(supportsAuthFileModelsRefresh('')).toBe(false);
  });
});

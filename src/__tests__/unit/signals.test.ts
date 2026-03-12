import { describe, test, expect, beforeEach } from 'bun:test';
import {
  registerCleanup,
  unregisterCleanup,
  _registrySize,
} from '../../lib/signals';

describe('signals cleanup registry', () => {
  beforeEach(() => {
    // Clear any leftover registrations between tests
    // Unregister known IDs used in these tests
    unregisterCleanup('test-a');
    unregisterCleanup('test-b');
  });

  test('registerCleanup adds entry to registry', () => {
    const before = _registrySize();
    registerCleanup('test-a', () => {});
    expect(_registrySize()).toBe(before + 1);

    // Cleanup
    unregisterCleanup('test-a');
  });

  test('registerCleanup replaces entry with same id', () => {
    registerCleanup('test-a', () => {});
    const sizeAfterFirst = _registrySize();

    registerCleanup('test-a', () => {});
    expect(_registrySize()).toBe(sizeAfterFirst);

    // Cleanup
    unregisterCleanup('test-a');
  });

  test('unregisterCleanup removes entry from registry', () => {
    registerCleanup('test-a', () => {});
    const sizeWithEntry = _registrySize();

    unregisterCleanup('test-a');
    expect(_registrySize()).toBe(sizeWithEntry - 1);
  });

  test('unregisterCleanup is safe for non-existent id', () => {
    const before = _registrySize();
    unregisterCleanup('does-not-exist');
    expect(_registrySize()).toBe(before);
  });

  test('multiple registrations tracked independently', () => {
    const before = _registrySize();
    registerCleanup('test-a', () => {});
    registerCleanup('test-b', () => {});
    expect(_registrySize()).toBe(before + 2);

    unregisterCleanup('test-a');
    expect(_registrySize()).toBe(before + 1);

    unregisterCleanup('test-b');
    expect(_registrySize()).toBe(before);
  });
});

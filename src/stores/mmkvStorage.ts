/**
 * MMKV Storage adapter for Zustand persist middleware.
 *
 * Creates encrypted MMKV instances for settings and history persistence.
 * Falls back to in-memory storage if MMKV is unavailable (web).
 */

import { createJSONStorage, type StateStorage } from 'zustand/middleware';
import { Platform } from 'react-native';

let mmkvInstances: Map<string, any> = new Map();

function getMMKVInstance(id: string, encryptionKey: string): StateStorage {
  if (Platform.OS === 'web') {
    // Web fallback: use localStorage
    return {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      removeItem: (key: string) => localStorage.removeItem(key),
    };
  }

  // Lazy import to avoid web bundling issues
  try {
    const { MMKV } = require('react-native-mmkv');
    if (!mmkvInstances.has(id)) {
      mmkvInstances.set(id, new MMKV({ id, encryptionKey }));
    }
    const instance = mmkvInstances.get(id)!;

    return {
      getItem: (key: string) => instance.getString(key) ?? null,
      setItem: (key: string, value: string) => instance.set(key, value),
      removeItem: (key: string) => instance.delete(key),
    };
  } catch {
    // Fallback if MMKV native module not linked
    console.warn('[MMKV] Native module not available, using in-memory storage');
    const memStore: Record<string, string> = {};
    return {
      getItem: (key: string) => memStore[key] ?? null,
      setItem: (key: string, value: string) => { memStore[key] = value; },
      removeItem: (key: string) => { delete memStore[key]; },
    };
  }
}

export function createMMKVStorage(id: string, encryptionKey: string) {
  return createJSONStorage(() => getMMKVInstance(id, encryptionKey));
}

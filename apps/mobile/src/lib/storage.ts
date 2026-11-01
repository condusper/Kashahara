import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const memory = new Map<string, string>();

function webStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function getStoredItem(key: string): Promise<string | null> {
  const web = webStorage();
  if (web) return web.getItem(key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

export async function setStoredItem(key: string, value: string): Promise<void> {
  const web = webStorage();
  if (web) {
    web.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    memory.set(key, value);
  }
}

export async function deleteStoredItem(key: string): Promise<void> {
  const web = webStorage();
  if (web) {
    web.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    memory.delete(key);
  }
}

export const storageKeys = {
  accessToken: 'kashahara.accessToken',
  refreshToken: 'kashahara.refreshToken',
  themeMode: 'kashahara.themeMode',
  hasOnboarded: 'kashahara.hasOnboarded',
  notifyTransactions: 'kashahara.notify.transactions',
  notifySecurity: 'kashahara.notify.security',
  notifyProduct: 'kashahara.notify.product',
} as const;

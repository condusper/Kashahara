import { deleteStoredItem, getStoredItem, setStoredItem, storageKeys } from './storage';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let loaded = false;

export async function loadTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  if (!loaded) {
    const [access, refresh] = await Promise.all([
      getStoredItem(storageKeys.accessToken),
      getStoredItem(storageKeys.refreshToken),
    ]);
    accessToken = access;
    refreshToken = refresh;
    loaded = true;
  }
  return { accessToken, refreshToken };
}

export async function saveTokens(next: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  accessToken = next.accessToken;
  refreshToken = next.refreshToken;
  loaded = true;
  await Promise.all([
    setStoredItem(storageKeys.accessToken, next.accessToken),
    setStoredItem(storageKeys.refreshToken, next.refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  loaded = true;
  await Promise.all([
    deleteStoredItem(storageKeys.accessToken),
    deleteStoredItem(storageKeys.refreshToken),
  ]);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

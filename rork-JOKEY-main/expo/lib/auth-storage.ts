import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'joky_jwt_token';
const USER_KEY = 'joky_user_data';

export async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    console.log('[AuthStorage] Token saved');
  } catch (err) {
    console.error('[AuthStorage] Failed to save token:', err);
  }
}

export async function removeAuthToken(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    console.log('[AuthStorage] Auth data removed');
  } catch (err) {
    console.error('[AuthStorage] Failed to remove auth data:', err);
  }
}

export async function getCachedUser(): Promise<Record<string, unknown> | null> {
  try {
    const data = await AsyncStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function setCachedUser(user: any): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    console.log('[AuthStorage] User cached:', user?.username || user?.id);
  } catch (err) {
    console.error('[AuthStorage] Failed to cache user:', err);
  }
}

export function extractUidFromToken(token: string): string | null {
  if (!token) return null;
  if (token.startsWith('client_')) {
    const parts = token.split('_');
    if (parts.length >= 4) {
      return parts.slice(1, parts.length - 1).join('_');
    }
  }
  if (token.startsWith('local_')) {
    return token.substring(6);
  }
  return null;
}

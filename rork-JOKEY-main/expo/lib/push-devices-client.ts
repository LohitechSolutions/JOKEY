import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import {
  getExpoPushTokenSafe,
  getPushPlatform,
  getStableDeviceId,
  isPushSupportedPlatform,
} from './push-notifications';

export type NotifyContentType = 'joke' | 'video' | 'image';

const LAST_PUSH_TOKEN_KEY = 'joky_last_expo_push_token';

async function rememberToken(token: string | null): Promise<void> {
  try {
    if (token) await AsyncStorage.setItem(LAST_PUSH_TOKEN_KEY, token);
    else await AsyncStorage.removeItem(LAST_PUSH_TOKEN_KEY);
  } catch {
    // no-op
  }
}

async function getRememberedToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Upsert the current device Expo push token for the authenticated user.
 * Dedupes by unique expo_push_token; updates user_id/enabled if the token moves.
 */
export async function upsertPushDevice(userId: string, enabled: boolean): Promise<string | null> {
  if (!isSupabaseConfigured || !userId || !isPushSupportedPlatform()) return null;

  try {
    const token = await getExpoPushTokenSafe();
    if (!token) {
      console.log('[PushDevices] No Expo push token available');
      return null;
    }

    const platform = getPushPlatform();
    const deviceId = await getStableDeviceId();
    const now = new Date().toISOString();

    const { error } = await supabase.from('push_devices').upsert(
      {
        user_id: userId,
        expo_push_token: token,
        platform,
        device_id: deviceId,
        enabled,
        updated_at: now,
      },
      { onConflict: 'expo_push_token' }
    );

    if (error) {
      console.warn('[PushDevices] upsert failed:', error.message);
      return null;
    }

    await rememberToken(token);
    console.log('[PushDevices] Token upserted, enabled=', enabled);
    return token;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[PushDevices] upsert exception:', message);
    return null;
  }
}

/** Mark this device as disabled (toggle off) without deleting the row. */
export async function disableCurrentPushDevice(): Promise<void> {
  if (!isSupabaseConfigured || !isPushSupportedPlatform()) return;
  try {
    const token = (await getExpoPushTokenSafe()) || (await getRememberedToken());
    if (!token) return;
    const { error } = await supabase
      .from('push_devices')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('expo_push_token', token);
    if (error) console.warn('[PushDevices] disable failed:', error.message);
  } catch (err) {
    console.warn('[PushDevices] disable exception:', err);
  }
}

/** Remove this device token on logout / uninstall-style cleanup. */
export async function removeCurrentPushDevice(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const token = (await getExpoPushTokenSafe()) || (await getRememberedToken());
    if (!token) {
      await rememberToken(null);
      return;
    }
    const { error } = await supabase.from('push_devices').delete().eq('expo_push_token', token);
    if (error) console.warn('[PushDevices] delete failed:', error.message);
    await rememberToken(null);
  } catch (err) {
    console.warn('[PushDevices] delete exception:', err);
  }
}

/**
 * Fan-out push via Supabase Edge Function `notify-new-content`.
 * Failures are logged only — publishing must never crash because of push.
 */
export async function notifyNewContentPublished(
  contentType: NotifyContentType,
  contentId?: string
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase.functions.invoke('notify-new-content', {
      body: {
        contentType,
        contentId: contentId || null,
      },
    });
    if (error) {
      console.warn('[PushDevices] notify invoke failed:', error.message);
    } else {
      console.log('[PushDevices] notify invoke ok:', contentType, contentId);
    }
  } catch (err) {
    console.warn('[PushDevices] notify invoke exception:', err);
  }
}

/**
 * Sync preference + OS permission into push_devices after login / app start.
 */
export async function syncPushRegistration(
  userId: string | null | undefined,
  notificationsPreferred: boolean
): Promise<void> {
  if (!userId || !isSupabaseConfigured || !isPushSupportedPlatform()) return;
  try {
    if (!notificationsPreferred) {
      await disableCurrentPushDevice();
      return;
    }
    await upsertPushDevice(userId, true);
  } catch (err) {
    console.warn('[PushDevices] syncPushRegistration failed:', err);
  }
}

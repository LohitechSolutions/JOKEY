import { Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';

export type PushPlatform = 'ios' | 'android';

export interface PushTokenRecord {
  id: string;
  userId: string;
  token: string;
  platform: PushPlatform;
  deviceName: string | null;
  updatedAt: string;
}

function toPlatform(): PushPlatform | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return null;
}

export async function savePushTokenToDB(
  userId: string,
  token: string,
  deviceName?: string | null
): Promise<boolean> {
  const platform = toPlatform();
  if (!platform || !isSupabaseConfigured) return false;

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform,
      device_name: deviceName ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' }
  );

  if (error) {
    console.warn('[Push] Failed to save token:', error.message);
    return false;
  }

  console.log('[Push] Token saved for user', userId);
  return true;
}

export async function removePushTokenFromDB(userId: string, token: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);

  if (error) {
    console.warn('[Push] Failed to remove token:', error.message);
  }
}

export async function removeAllPushTokensForUser(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from('push_tokens').delete().eq('user_id', userId);

  if (error) {
    console.warn('[Push] Failed to remove user tokens:', error.message);
  }
}

export async function fetchPushTokensForUser(userId: string): Promise<PushTokenRecord[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('push_tokens')
    .select('id, user_id, token, platform, device_name, updated_at')
    .eq('user_id', userId);

  if (error || !data) {
    console.warn('[Push] Failed to fetch tokens:', error?.message);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    userId: row.user_id,
    token: row.token,
    platform: row.platform as PushPlatform,
    deviceName: row.device_name,
    updatedAt: row.updated_at,
  }));
}

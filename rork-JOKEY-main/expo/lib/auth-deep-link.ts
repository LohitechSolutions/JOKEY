import * as Linking from 'expo-linking';
import { supabase, isSupabaseConfigured } from './supabase';

export type AuthDeepLinkResult = 'recovery' | 'sign-in' | null;

function isRecoveryUrl(url: string): boolean {
  return (
    url.includes('reset-password') ||
    url.includes('type=recovery') ||
    url.includes('type%3Drecovery')
  );
}

function parseAuthParams(url: string): URLSearchParams | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex !== -1) {
    return new URLSearchParams(url.substring(hashIndex + 1));
  }

  const queryIndex = url.indexOf('?');
  if (queryIndex !== -1) {
    return new URLSearchParams(url.substring(queryIndex + 1));
  }

  return null;
}

export function getPasswordResetRedirectUrl(): string {
  return Linking.createURL('reset-password');
}

export async function handleAuthDeepLink(url: string): Promise<AuthDeepLinkResult> {
  if (!url || !isSupabaseConfigured) return null;

  const recoveryLink = isRecoveryUrl(url);
  const hasAuthPayload =
    recoveryLink ||
    url.includes('access_token=') ||
    url.includes('code=') ||
    url.includes('token_hash=');

  if (!hasAuthPayload) return null;

  console.log('[AuthDeepLink] Handling URL:', url.substring(0, 80) + '...');

  try {
    if (url.includes('code=')) {
      const { error } = await supabase.auth.exchangeCodeForSession(url);
      if (error) throw error;
      return recoveryLink ? 'recovery' : 'sign-in';
    }

    const params = parseAuthParams(url);
    if (!params) return recoveryLink ? 'recovery' : null;

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');
    const tokenHash = params.get('token_hash');

    if (tokenHash && type === 'recovery') {
      const { error } = await supabase.auth.verifyOtp({
        type: 'recovery',
        token_hash: tokenHash,
      });
      if (error) throw error;
      return 'recovery';
    }

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      return type === 'recovery' || recoveryLink ? 'recovery' : 'sign-in';
    }
  } catch (err: any) {
    console.error('[AuthDeepLink] Failed:', err?.message || err);
    throw err;
  }

  return recoveryLink ? 'recovery' : null;
}

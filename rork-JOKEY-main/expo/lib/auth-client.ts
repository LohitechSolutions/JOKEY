import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { PRESERVED_STORAGE_KEYS } from '@/constants/app-config';
import { getPasswordResetRedirectUrl } from './auth-deep-link';
import { User } from '@/types';
import { removeAuthToken } from './auth-storage';

export { isSupabaseConfigured as isClientDBAvailable };

const LOCAL_USERS_KEY = 'joky_local_users';

interface LocalUserRecord {
  id: string;
  username: string;
  email: string;
  password: string;
  role: string;
  createdAt: string;
}

async function getLocalUsers(): Promise<LocalUserRecord[]> {
  try {
    const data = await AsyncStorage.getItem(LOCAL_USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

async function saveLocalUsers(users: LocalUserRecord[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function generateLocalId(): string {
  return 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

function supabaseUserToAppUser(supabaseUser: any, profile: any): User {
  return {
    id: supabaseUser.id,
    username: profile?.username || supabaseUser.user_metadata?.username || supabaseUser.email?.split('@')[0] || 'user',
    displayName: profile?.display_name || profile?.username || supabaseUser.user_metadata?.username || 'User',
    avatar: profile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.username || supabaseUser.user_metadata?.username || 'U')}&background=1565C0&color=fff&size=150`,
    bio: profile?.bio || '',
    language: profile?.language || 'FR',
    role: profile?.role || supabaseUser.user_metadata?.role || 'visitor',
    jokesCount: profile?.jokes_count || 0,
    totalLikes: profile?.total_likes || 0,
    followersCount: profile?.followers_count || 0,
    followingCount: profile?.following_count || 0,
    badges: profile?.badges || [],
    createdAt: profile?.created_at || supabaseUser.created_at || new Date().toISOString(),
    isFollowing: false,
    isAdmin: profile?.is_admin === true,
  };
}

export async function clientRegister(input: {
  username: string;
  email: string;
  password: string;
  language?: string;
  role?: string;
}): Promise<{ token: string; user: User }> {
  console.log('[AuthClient] Register called. Supabase configured:', isSupabaseConfigured);

  if (!isSupabaseConfigured) {
    console.log('[AuthClient] Local-only mode: registering locally');
    const normalizedEmail = input.email.trim().toLowerCase();
    const localUsers = await getLocalUsers();

    if (localUsers.find(u => u.email === normalizedEmail)) {
      throw new Error('Un compte avec cet email existe déjà');
    }
    if (localUsers.find(u => u.username === input.username)) {
      throw new Error('Ce pseudo est déjà pris');
    }

    const newId = generateLocalId();
    const now = new Date().toISOString();
    const record: LocalUserRecord = {
      id: newId,
      username: input.username,
      email: normalizedEmail,
      password: input.password,
      role: 'creator',
      createdAt: now,
    };
    localUsers.push(record);
    await saveLocalUsers(localUsers);

    const user: User = {
      id: newId,
      username: input.username,
      displayName: input.username,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(input.username)}&background=1565C0&color=fff&size=150`,
      bio: '',
      language: input.language || 'FR',
      role: 'creator',
      jokesCount: 0,
      totalLikes: 0,
      followersCount: 0,
      followingCount: 0,
      badges: [],
      createdAt: now,
      isFollowing: false,
    };

    console.log('[AuthClient] Local register success:', user.username);
    return { token: 'local_' + newId, user };
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  console.log('[AuthClient] Supabase register:', normalizedEmail);

  try {
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', input.username)
      .single();

    if (existingUser) {
      throw new Error('Ce pseudo est déjà pris');
    }
  } catch (err: any) {
    if (err?.message === 'Ce pseudo est déjà pris') throw err;
    console.log('[AuthClient] Username check skipped (table may not exist):', err?.message);
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: input.password,
    options: {
      data: {
        username: input.username,
        role: 'creator',
      },
    },
  });

  if (error) {
    console.error('[AuthClient] Supabase signUp error:', error.message);
    if (error.message.includes('already registered') || error.message.includes('already been registered')) {
      throw new Error('Un compte avec cet email existe déjà');
    }
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Erreur lors de la création du compte');
  }

  console.log('[AuthClient] Supabase user created:', data.user.id);

  try {
    const { error: profileError } = await supabase.from('users').insert({
      id: data.user.id,
      username: input.username,
      email: normalizedEmail,
      display_name: input.username,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(input.username)}&background=1565C0&color=fff&size=150`,
      bio: '',
      language: input.language || 'FR',
      role: 'creator',
      jokes_count: 0,
      total_likes: 0,
      followers_count: 0,
      following_count: 0,
      badges: [],
      is_admin: false,
      is_subscribed: false,
    });

    if (profileError) {
      console.warn('[AuthClient] Profile insert error (non-fatal):', profileError.message);
    }
  } catch (profileErr: any) {
    console.warn('[AuthClient] Profile insert exception (non-fatal):', profileErr?.message);
  }

  const token = data.session?.access_token || 'supabase_' + data.user.id;

  const user: User = {
    id: data.user.id,
    username: input.username,
    displayName: input.username,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(input.username)}&background=1565C0&color=fff&size=150`,
    bio: '',
    language: input.language || 'FR',
    role: 'creator',
    jokesCount: 0,
    totalLikes: 0,
    followersCount: 0,
    followingCount: 0,
    badges: [],
    createdAt: data.user.created_at || new Date().toISOString(),
    isFollowing: false,
  };

  console.log('[AuthClient] Register success:', user.username);
  return { token, user };
}

export async function clientLogin(input: {
  email: string;
  password: string;
}): Promise<{ token: string; user: User }> {
  console.log('[AuthClient] Login called. Supabase configured:', isSupabaseConfigured);

  if (!isSupabaseConfigured) {
    console.log('[AuthClient] Local-only mode: logging in locally');
    const normalizedEmail = input.email.trim().toLowerCase();
    const localUsers = await getLocalUsers();
    const found = localUsers.find(u => u.email === normalizedEmail);

    if (!found) {
      throw new Error('Aucun compte trouvé avec cet email');
    }
    if (found.password !== input.password) {
      throw new Error('Email ou mot de passe incorrect');
    }

    const user: User = {
      id: found.id,
      username: found.username,
      displayName: found.username,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(found.username)}&background=1565C0&color=fff&size=150`,
      bio: '',
      language: 'FR',
      role: (found.role as 'creator' | 'visitor') || 'visitor',
      jokesCount: 0,
      totalLikes: 0,
      followersCount: 0,
      followingCount: 0,
      badges: [],
      createdAt: found.createdAt,
      isFollowing: false,
    };

    console.log('[AuthClient] Local login success:', user.username);
    return { token: 'local_' + found.id, user };
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  console.log('[AuthClient] Supabase login:', normalizedEmail);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: input.password,
  });

  if (error) {
    console.error('[AuthClient] Supabase login error:', error.message);
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('Email ou mot de passe incorrect');
    }
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Aucun compte trouvé avec cet email');
  }

  console.log('[AuthClient] Supabase login success:', data.user.id);

  let profile: any = null;
  const { data: profileData, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single();
  if (profileError) {
    console.warn('[AuthClient] Profile fetch failed (non-fatal):', profileError.message);
  } else {
    profile = profileData;
  }

  const token = data.session?.access_token || 'supabase_' + data.user.id;
  const user = supabaseUserToAppUser(data.user, profile);

  console.log('[AuthClient] Login success:', user.username, 'isAdmin:', user.isAdmin === true);
  return { token, user };
}

export async function clientGetMe(uid: string): Promise<User | null> {
  console.log('[AuthClient] getMe for:', uid);

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', uid)
    .single();

  if (!profileError && profile) {
    let authUser: any = { id: uid, created_at: '' };
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) authUser = user;
    } catch {
      console.log('[AuthClient] getUser failed, using fallback');
    }
    const user = supabaseUserToAppUser(authUser, profile);
    console.log('[AuthClient] getMe success:', user.username, 'isAdmin:', user.isAdmin === true);
    return user;
  }

  if (profileError) {
    console.warn('[AuthClient] getMe profile error:', profileError.message);
  }

  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      return supabaseUserToAppUser(authUser, null);
    }
  } catch {
    console.log('[AuthClient] Fallback getUser also failed');
  }

  return null;
}

export async function clientRequestPasswordReset(email: string): Promise<{ success: boolean; code: string | null }> {
  console.log('[AuthClient] Password reset called. Supabase configured:', isSupabaseConfigured);

  if (!isSupabaseConfigured) {
    console.log('[AuthClient] Local mode: password reset simulated');
    return { success: true, code: '000000' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  console.log('[AuthClient] Password reset request for:', normalizedEmail);

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: getPasswordResetRedirectUrl(),
  });

  if (error) {
    console.error('[AuthClient] Reset password error:', error.message);
    throw new Error(error.message);
  }

  return { success: true, code: null };
}

export async function clientConfirmPasswordReset(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<{ success: boolean }> {
  console.log('[AuthClient] Confirm password reset');

  if (!isSupabaseConfigured) {
    console.log('[AuthClient] Local mode: updating password locally');
    const normalizedEmail = input.email.trim().toLowerCase();
    const localUsers = await getLocalUsers();
    const idx = localUsers.findIndex(u => u.email === normalizedEmail);
    if (idx >= 0) {
      localUsers[idx].password = input.newPassword;
      await saveLocalUsers(localUsers);
    }
    return { success: true };
  }

  const { error } = await supabase.auth.updateUser({
    password: input.newPassword,
  });

  if (error) {
    console.error('[AuthClient] Update password error:', error.message);
    throw new Error(error.message);
  }

  await supabase.auth.signOut();

  return { success: true };
}

export async function clientDeleteAccount(uid: string): Promise<void> {
  console.log('[AuthClient] Deleting account:', uid);

  try {
    const { deleteUserDataFromDB } = await import('./db-client');
    await deleteUserDataFromDB(uid);
  } catch (err: any) {
    console.warn('[AuthClient] deleteUserData error (non-fatal):', err?.message);
  }

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.rpc('delete_own_account');
      if (error) {
        console.warn('[AuthClient] delete_own_account RPC failed:', error.message);
      }
    } catch (err: any) {
      console.warn('[AuthClient] delete_own_account RPC error:', err?.message);
    }
  }

  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[AuthClient] signOut error during delete:', err);
  }

  console.log('[AuthClient] Account deleted');
}

export async function getSupabaseSession(): Promise<{ userId: string; token: string } | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return {
        userId: session.user.id,
        token: session.access_token,
      };
    }
  } catch (err: any) {
    console.warn('[AuthClient] getSession error:', err?.message);
  }
  return null;
}

export async function signOutSupabase(): Promise<void> {
  console.log('[AuthClient] signOutSupabase called');
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut();
      console.log('[AuthClient] Supabase signOut success');
    } catch (err: any) {
      console.warn('[AuthClient] signOut error (continuing cleanup):', err?.message);
    }
  } else {
    console.log('[AuthClient] Local mode: skipping Supabase signOut');
  }
  try {
    await removeAuthToken();
    console.log('[AuthClient] Auth tokens removed');
  } catch (err: any) {
    console.warn('[AuthClient] removeAuthToken error:', err?.message);
  }
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const jokyKeys = allKeys.filter(
      (k) =>
        k.startsWith('joky_') &&
        !PRESERVED_STORAGE_KEYS.includes(k as (typeof PRESERVED_STORAGE_KEYS)[number])
    );
    if (jokyKeys.length > 0) {
      await AsyncStorage.multiRemove(jokyKeys);
      console.log('[AuthClient] Cleared', jokyKeys.length, 'joky keys from storage');
    }
  } catch (err: any) {
    console.warn('[AuthClient] AsyncStorage cleanup error:', err?.message);
  }
  console.log('[AuthClient] Sign out cleanup complete');
}

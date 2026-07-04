import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';
import { MODERATION_EMAIL } from '@/constants/app-config';

const BLOCKED_USERS_KEY = 'joky_blocked_users';
const LOCAL_REPORTS_KEY = 'joky_local_reports';

export type ReportTargetType = 'joke' | 'video' | 'comment' | 'user';
export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'hate' | 'other';

export interface ReportPayload {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
}

export interface BlockedUserEntry {
  id: string;
  username: string;
}

function blockedUsersKey(userId: string): string {
  return `${BLOCKED_USERS_KEY}:${userId}`;
}

async function readBlockedEntries(userId: string): Promise<BlockedUserEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(blockedUsersKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BlockedUserEntry[] | string[];
    if (parsed.length === 0) return [];
    if (typeof parsed[0] === 'string') {
      return (parsed as string[]).map((id) => ({ id, username: id.slice(0, 8) }));
    }
    return parsed as BlockedUserEntry[];
  } catch {
    return [];
  }
}

async function writeBlockedEntries(userId: string, entries: BlockedUserEntry[]): Promise<void> {
  await AsyncStorage.setItem(blockedUsersKey(userId), JSON.stringify(entries));
}

export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const entries = await readBlockedEntries(userId);
  return entries.map((e) => e.id);
}

export async function getBlockedUsers(userId: string): Promise<BlockedUserEntry[]> {
  return readBlockedEntries(userId);
}

export async function syncBlockedUsersFromDB(userId: string): Promise<BlockedUserEntry[]> {
  const local = await readBlockedEntries(userId);

  if (!isSupabaseConfigured) return local;

  try {
    const { data, error } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', userId);

    if (error || !data) return local;

    const localMap = new Map(local.map((e) => [e.id, e]));
    const remoteIds = data.map((row) => row.blocked_id).filter(Boolean) as string[];

    for (const blockedId of remoteIds) {
      if (!localMap.has(blockedId)) {
        const { data: userRow } = await supabase
          .from('users')
          .select('username')
          .eq('id', blockedId)
          .single();
        localMap.set(blockedId, {
          id: blockedId,
          username: userRow?.username ?? blockedId.slice(0, 8),
        });
      }
    }

    const merged = Array.from(localMap.values());
    await writeBlockedEntries(userId, merged);
    return merged;
  } catch (err) {
    console.warn('[Moderation] syncBlockedUsersFromDB failed:', err);
    return local;
  }
}

export async function blockUser(
  currentUserId: string,
  blockedUserId: string,
  username?: string
): Promise<void> {
  if (currentUserId === blockedUserId) return;

  const blocked = await readBlockedEntries(currentUserId);
  if (!blocked.some((e) => e.id === blockedUserId)) {
    blocked.push({ id: blockedUserId, username: username ?? blockedUserId.slice(0, 8) });
    await writeBlockedEntries(currentUserId, blocked);
  }

  if (isSupabaseConfigured) {
    const { error } = await supabase.from('blocked_users').upsert(
      { blocker_id: currentUserId, blocked_id: blockedUserId },
      { onConflict: 'blocker_id,blocked_id' }
    );
    if (error) console.warn('[Moderation] Supabase block failed:', error.message);
  }
}

export async function unblockUser(currentUserId: string, blockedUserId: string): Promise<void> {
  const blocked = (await readBlockedEntries(currentUserId)).filter((e) => e.id !== blockedUserId);
  await writeBlockedEntries(currentUserId, blocked);

  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', blockedUserId);
    if (error) console.warn('[Moderation] Supabase unblock failed:', error.message);
  }
}

async function saveLocalReport(report: ReportPayload & { createdAt: string }): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_REPORTS_KEY);
    const reports = raw ? (JSON.parse(raw) as typeof report[]) : [];
    reports.push(report);
    await AsyncStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(reports.slice(-100)));
  } catch {
    // Non-critical
  }
}

export async function submitReport(payload: ReportPayload): Promise<boolean> {
  const report = { ...payload, createdAt: new Date().toISOString() };
  await saveLocalReport(report);

  if (isSupabaseConfigured) {
    const { error } = await supabase.from('reports').insert({
      reporter_id: payload.reporterId,
      target_type: payload.targetType,
      target_id: payload.targetId,
      reason: payload.reason,
      details: payload.details ?? null,
    });
    if (error) {
      console.warn('[Moderation] Supabase report failed:', error.message);
      return false;
    }
  }

  return true;
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function showReportDialog(
  t: TranslateFn,
  onSubmit: (reason: ReportReason) => void | Promise<void>
): void {
  Alert.alert(t('moderation.reportTitle'), t('moderation.reportSelectReason'), [
    { text: t('moderation.reason.spam'), onPress: () => void onSubmit('spam') },
    { text: t('moderation.reason.harassment'), onPress: () => void onSubmit('harassment') },
    { text: t('moderation.reason.inappropriate'), onPress: () => void onSubmit('inappropriate') },
    { text: t('moderation.reason.hate'), onPress: () => void onSubmit('hate') },
    { text: t('moderation.reason.other'), onPress: () => void onSubmit('other') },
    { text: t('common.cancel'), style: 'cancel' },
  ]);
}

export function showReportSuccess(t: TranslateFn): void {
  Alert.alert(t('moderation.reportSuccessTitle'), t('moderation.reportSuccessMsg', { email: MODERATION_EMAIL }));
}

export function showReportFailed(t: TranslateFn): void {
  Alert.alert(t('auth.error'), t('moderation.reportFailed'));
}

export function showLoginRequiredForReport(t: TranslateFn): void {
  Alert.alert(t('moderation.loginToReport'), t('joke.loginToCommentMsg'));
}

export async function handleReport(
  t: TranslateFn,
  isAuthenticated: boolean,
  submit: (reason: ReportReason) => Promise<boolean>
): Promise<void> {
  if (!isAuthenticated) {
    showLoginRequiredForReport(t);
    return;
  }
  showReportDialog(t, async (reason) => {
    const ok = await submit(reason);
    if (ok) showReportSuccess(t);
    else showReportFailed(t);
  });
}

export function showBlockConfirm(
  t: TranslateFn,
  username: string,
  onConfirm: () => void | Promise<void>
): void {
  Alert.alert(
    t('moderation.blockTitle'),
    t('moderation.blockMsg', { username }),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('moderation.block'), style: 'destructive', onPress: () => void onConfirm() },
    ]
  );
}

export function showUnblockConfirm(
  t: TranslateFn,
  username: string,
  onConfirm: () => void | Promise<void>
): void {
  Alert.alert(
    t('moderation.unblockConfirmTitle'),
    t('moderation.unblockConfirmMsg', { username }),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('moderation.unblock'), onPress: () => void onConfirm() },
    ]
  );
}

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

function blockedUsersKey(userId: string): string {
  return `${BLOCKED_USERS_KEY}:${userId}`;
}

export async function getBlockedUserIds(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(blockedUsersKey(userId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function blockUser(currentUserId: string, blockedUserId: string): Promise<void> {
  if (currentUserId === blockedUserId) return;

  const blocked = await getBlockedUserIds(currentUserId);
  if (!blocked.includes(blockedUserId)) {
    blocked.push(blockedUserId);
    await AsyncStorage.setItem(blockedUsersKey(currentUserId), JSON.stringify(blocked));
  }

  if (isSupabaseConfigured) {
    await supabase.from('blocked_users').upsert(
      { blocker_id: currentUserId, blocked_id: blockedUserId },
      { onConflict: 'blocker_id,blocked_id' }
    );
  }
}

export async function unblockUser(currentUserId: string, blockedUserId: string): Promise<void> {
  const blocked = (await getBlockedUserIds(currentUserId)).filter((id) => id !== blockedUserId);
  await AsyncStorage.setItem(blockedUsersKey(currentUserId), JSON.stringify(blocked));

  if (isSupabaseConfigured) {
    await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', blockedUserId);
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

export async function submitReport(payload: ReportPayload): Promise<void> {
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
    }
  }
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

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import type { Router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  savePushTokenToDB,
  removePushTokenFromDB,
  removeAllPushTokensForUser,
} from './push-notifications-client';

const PUSH_TOKEN_STORAGE_KEY = 'joky_expo_push_token';

export type NotificationPayload = {
  type?: 'joke' | 'video' | 'user' | 'profile' | 'settings';
  id?: string;
  url?: string;
};

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function getExpoProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });

  await Notifications.setNotificationChannelAsync('social', {
    name: 'Social',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200],
    lightColor: '#FF231F7C',
  });

  await Notifications.setNotificationChannelAsync('content', {
    name: 'New content',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 150],
    lightColor: '#FF231F7C',
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!Device.isDevice) return false;

  await ensureAndroidChannels();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return status === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null;

  const projectId = getExpoProjectId();
  if (!projectId) {
    console.warn(
      '[Push] Missing EAS projectId. Add extra.eas.projectId to app.json (run `npx eas init`).'
    );
  }

  try {
    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    return tokenData.data;
  } catch (error) {
    console.error('[Push] Error fetching Expo push token:', error);
    return null;
  }
}

export async function registerPushNotifications(userId: string): Promise<string | null> {
  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  const token = await getExpoPushToken();
  if (!token) return null;

  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  await savePushTokenToDB(userId, token, Device.modelName ?? null);
  return token;
}

export async function unregisterPushNotifications(userId?: string | null): Promise<void> {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);

  if (userId && token) {
    await removePushTokenFromDB(userId, token);
  } else if (userId) {
    await removeAllPushTokensForUser(userId);
  }

  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}

function navigateFromNotificationData(router: Router, data: NotificationPayload): void {
  if (data.url) {
    router.push(data.url as any);
    return;
  }

  switch (data.type) {
    case 'joke':
      if (data.id) router.push(`/joke/${data.id}`);
      break;
    case 'video':
      if (data.id) router.push('/(tabs)/videos');
      break;
    case 'user':
      if (data.id) router.push(`/user/${data.id}`);
      break;
    case 'profile':
      router.push('/(tabs)/profile');
      break;
    case 'settings':
      router.push('/settings');
      break;
    default:
      break;
  }
}

export function setupNotificationListeners(router: Router): () => void {
  if (Platform.OS === 'web') {
    return () => {};
  }

  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    console.log('[Push] Foreground notification:', notification.request.content.title);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data ?? {}) as NotificationPayload;
    navigateFromNotificationData(router, data);
  });

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response) return;
    const data = (response.notification.request.content.data ?? {}) as NotificationPayload;
    navigateFromNotificationData(router, data);
  });

  return () => {
    Notifications.removeNotificationSubscription(receivedSub);
    Notifications.removeNotificationSubscription(responseSub);
  };
}

export async function syncPushNotificationPreference(
  userId: string,
  enabled: boolean
): Promise<{ ok: boolean; permissionDenied?: boolean }> {
  if (Platform.OS === 'web') {
    return { ok: true };
  }

  if (!enabled) {
    await unregisterPushNotifications(userId);
    return { ok: true };
  }

  const granted = await requestNotificationPermissions();
  if (!granted) {
    return { ok: false, permissionDenied: true };
  }

  const token = await registerPushNotifications(userId);
  return { ok: !!token };
}

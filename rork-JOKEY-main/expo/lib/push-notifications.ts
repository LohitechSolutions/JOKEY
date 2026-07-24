import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';

export const JOKEY_NOTIFICATION_CHANNEL_ID = 'jokey-content';

export type PushPermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function resolveProjectId(): string | null {
  const fromExtra =
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    null;
  if (typeof fromExtra === 'string' && fromExtra.trim().length > 0) {
    return fromExtra.trim();
  }
  return null;
}

export function isPushSupportedPlatform(): boolean {
  if (Platform.OS === 'web') return false;
  return Device.isDevice;
}

export function getPushPlatform(): 'ios' | 'android' | 'web' | 'unknown' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

export async function getStableDeviceId(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      return Application.getAndroidId() || null;
    }
    if (Platform.OS === 'ios') {
      return (await Application.getIosIdForVendorAsync()) || null;
    }
  } catch (err) {
    console.warn('[Push] getStableDeviceId failed:', err);
  }
  return null;
}

export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(JOKEY_NOTIFICATION_CHANNEL_ID, {
      name: 'Jokey content',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1565C0',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  } catch (err) {
    console.warn('[Push] Android channel setup failed:', err);
  }
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (!isPushSupportedPlatform()) return 'unsupported';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch (err) {
    console.warn('[Push] getPermissionsAsync failed:', err);
    return 'undetermined';
  }
}

export async function requestPushPermissions(): Promise<PushPermissionState> {
  if (!isPushSupportedPlatform()) return 'unsupported';
  try {
    await ensureAndroidNotificationChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return 'granted';

    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    if (requested.status === 'granted') return 'granted';
    if (requested.status === 'denied') return 'denied';
    return 'undetermined';
  } catch (err) {
    console.warn('[Push] requestPermissionsAsync failed:', err);
    return 'denied';
  }
}

export async function getExpoPushTokenSafe(): Promise<string | null> {
  if (!isPushSupportedPlatform()) return null;

  try {
    await ensureAndroidNotificationChannel();
    const permission = await getPushPermissionState();
    if (permission !== 'granted') return null;

    const projectId = resolveProjectId();
    const tokenResponse = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    const token = tokenResponse?.data;
    if (typeof token === 'string' && token.startsWith('ExponentPushToken')) {
      return token;
    }
    console.warn('[Push] Unexpected token format:', token);
    return typeof token === 'string' ? token : null;
  } catch (err) {
    console.warn('[Push] getExpoPushTokenAsync failed:', err);
    return null;
  }
}

export async function openSystemNotificationSettings(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL('app-settings:');
      return;
    }
    await Linking.openSettings();
  } catch (err) {
    console.warn('[Push] openSystemNotificationSettings failed:', err);
    try {
      await Linking.openSettings();
    } catch {
      // no-op
    }
  }
}

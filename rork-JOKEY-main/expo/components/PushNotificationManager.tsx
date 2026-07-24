import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import {
  registerPushNotifications,
  setupNotificationListeners,
  unregisterPushNotifications,
} from '@/lib/push-notifications';

export default function PushNotificationManager() {
  const router = useRouter();
  const { isAuthenticated, currentUser, settings, authChecked } = useApp();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    return setupNotificationListeners(router);
  }, [router]);

  useEffect(() => {
    if (Platform.OS === 'web' || !authChecked) return;

    const userId = currentUser?.id;
    const shouldRegister = isAuthenticated && !!userId && settings.notifications;

    if (!shouldRegister) {
      if (userId) {
        void unregisterPushNotifications(userId);
      }
      return;
    }

    void registerPushNotifications(userId);
  }, [authChecked, isAuthenticated, currentUser?.id, settings.notifications]);

  return null;
}

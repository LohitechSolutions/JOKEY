import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  Shield,
  Eye,
  Globe,
  FileText,
  LogOut,
  Trash2,
  ChevronRight,
  Lock,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { APP_VERSION, PRIVACY_POLICY_URL } from '@/constants/app-config';
import { LANGUAGE_OPTIONS } from '@/constants/translations';
import { showUnblockConfirm } from '@/lib/moderation-client';
import { syncPushNotificationPreference } from '@/lib/push-notifications';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    currentUser,
    logout, deleteAccount, isLoggingOut, isDeletingAccount,
    settings, updateSettings,
    blockedUsers, unblockUser,
  } = useApp();
  // App is fully free - no subscription needed
  const { t, language, changeLanguage } = useLanguage();
  const [showLangPicker, setShowLangPicker] = React.useState(false);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = React.useState(false);

  const handleToggleNotifications = async (val: boolean) => {
    if (!currentUser) {
      Alert.alert(t('settings.notifications'), t('settings.notificationsLoginRequired'));
      return;
    }

    setIsUpdatingNotifications(true);
    try {
      const result = await syncPushNotificationPreference(currentUser.id, val);

      if (!result.ok) {
        Alert.alert(
          t('settings.notifications'),
          result.permissionDenied
            ? t('settings.notificationsPermissionDenied')
            : t('settings.notificationsEnableError')
        );
        return;
      }

      updateSettings({ ...settings, notifications: val });
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  const handleToggleSafeMode = (val: boolean) => {
    updateSettings({ ...settings, safeMode: val });
  };

  const handleToggleAutoplay = (val: boolean) => {
    updateSettings({ ...settings, autoplay: val });
  };

  const handleLogout = () => {
    Alert.alert(
      t('settings.logoutTitle'),
      t('settings.logoutMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.disconnect'),
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteTitle'),
      t('settings.deleteMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.delete'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('settings.deleteFinalTitle'),
              t('settings.deleteFinalMsg'),
              [
                { text: t('settings.keepAccount'), style: 'cancel' },
                {
                  text: t('settings.yesDelete'),
                  style: 'destructive',
                  onPress: () => deleteAccount(),
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: t('settings.title'),
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <ArrowLeft size={22} color={Colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.preferences')}</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconBox, { backgroundColor: Colors.primary + '15' }]}>
              <Bell size={18} color={Colors.primary} />
            </View>
            <Text style={styles.settingText}>{t('settings.notifications')}</Text>
          </View>
          <Switch
            value={settings.notifications}
            onValueChange={handleToggleNotifications}
            disabled={isUpdatingNotifications}
            trackColor={{ false: Colors.cardBorder, true: Colors.primary + '60' }}
            thumbColor={settings.notifications ? Colors.primary : Colors.textMuted}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconBox, { backgroundColor: Colors.success + '15' }]}>
              <Shield size={18} color={Colors.success} />
            </View>
            <View>
              <Text style={styles.settingText}>{t('settings.safeMode')}</Text>
              <Text style={styles.settingSubtext}>{t('settings.safeModeDesc')}</Text>
            </View>
          </View>
          <Switch
            value={settings.safeMode}
            onValueChange={handleToggleSafeMode}
            trackColor={{ false: Colors.cardBorder, true: Colors.success + '60' }}
            thumbColor={settings.safeMode ? Colors.success : Colors.textMuted}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconBox, { backgroundColor: Colors.secondary + '30' }]}>
              <Eye size={18} color={Colors.warning} />
            </View>
            <View>
              <Text style={styles.settingText}>{t('settings.autoplay')}</Text>
              <Text style={styles.settingSubtext}>{t('settings.autoplayDesc')}</Text>
            </View>
          </View>
          <Switch
            value={settings.autoplay}
            onValueChange={handleToggleAutoplay}
            trackColor={{ false: Colors.cardBorder, true: Colors.secondary + '80' }}
            thumbColor={settings.autoplay ? Colors.warning : Colors.textMuted}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        <TouchableOpacity style={styles.settingRow} onPress={() => setShowLangPicker(!showLangPicker)}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#42A5F5' + '15' }]}>
              <Globe size={18} color="#42A5F5" />
            </View>
            <Text style={styles.settingText}>
              {LANGUAGE_OPTIONS.find(l => l.id === language)?.flag} {LANGUAGE_OPTIONS.find(l => l.id === language)?.label}
            </Text>
          </View>
          <ChevronRight size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        {showLangPicker && (
          <View style={styles.langPicker}>
            {LANGUAGE_OPTIONS.map((lang) => (
              <TouchableOpacity
                key={lang.id}
                style={[
                  styles.langOption,
                  language === lang.id && styles.langOptionActive,
                ]}
                onPress={() => {
                  changeLanguage(lang.id);
                  setShowLangPicker(false);
                }}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={[
                  styles.langLabel,
                  language === lang.id && styles.langLabelActive,
                ]}>{lang.label}</Text>
                {language === lang.id && <Text style={styles.langCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {currentUser?.isAdmin ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.admin')}</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/admin')}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: Colors.primary + '15' }]}>
                <Shield size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.settingText}>{t('settings.adminPanel')}</Text>
                <Text style={styles.settingSubtext}>{t('settings.adminManageDrawings')}</Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.security')}</Text>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => router.push('/change-password')}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconBox, { backgroundColor: Colors.warning + '15' }]}>
              <Lock size={18} color={Colors.warning} />
            </View>
            <View>
              <Text style={styles.settingText}>{t('settings.changePassword')}</Text>
              <Text style={styles.settingSubtext}>{t('settings.changePasswordDesc')}</Text>
            </View>
          </View>
          <ChevronRight size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('moderation.blockedUsers')}</Text>
        {blockedUsers.length === 0 ? (
          <View style={styles.settingRow}>
            <Text style={styles.settingSubtext}>{t('moderation.noBlockedUsers')}</Text>
          </View>
        ) : (
          blockedUsers.map((entry) => (
            <TouchableOpacity
              key={entry.id}
              style={styles.settingRow}
              onPress={() => {
                showUnblockConfirm(t, entry.username, () => void unblockUser(entry.id));
              }}
            >
              <Text style={styles.settingText}>@{entry.username}</Text>
              <Text style={styles.unblockText}>{t('moderation.unblock')}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.legal')}</Text>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => router.push('/terms')}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconBox, { backgroundColor: Colors.textMuted + '15' }]}>
              <FileText size={18} color={Colors.textMuted} />
            </View>
            <Text style={styles.settingText}>{t('settings.terms')}</Text>
          </View>
          <ChevronRight size={18} color={Colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => router.push('/privacy')}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.iconBox, { backgroundColor: Colors.textMuted + '15' }]}>
              <Shield size={18} color={Colors.textMuted} />
            </View>
            <Text style={styles.settingText}>{t('settings.privacy')}</Text>
          </View>
          <ChevronRight size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.dangerSection}>
        <Text style={styles.sectionTitle}>{t('settings.account')}</Text>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <LogOut size={18} color={Colors.primary} />
              <Text style={styles.logoutText}>{t('profile.logout')}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDeleteAccount}
          disabled={isDeletingAccount}
        >
          {isDeletingAccount ? (
            <ActivityIndicator color={Colors.error} />
          ) : (
            <>
              <Trash2 size={18} color={Colors.error} />
              <Text style={styles.deleteText}>{t('profile.deleteAccount')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Jokey v{APP_VERSION}</Text>
      <Text style={styles.privacyUrl}>{PRIVACY_POLICY_URL}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  headerBtn: {
    padding: 4,
  },
  section: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  dangerSection: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  settingSubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: Colors.card,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
    marginBottom: 10,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: Colors.card,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.error + '40',
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.error,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 20,
  },
  privacyUrl: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  unblockText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  langPicker: {
    marginTop: 6,
    gap: 6,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    gap: 12,
  },
  langOptionActive: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary + '40',
  },
  langFlag: {
    fontSize: 22,
  },
  langLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
    flex: 1,
  },
  langLabelActive: {
    color: Colors.primary,
  },
  langCheck: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
});

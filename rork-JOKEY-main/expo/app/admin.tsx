import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Shield, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AdminScreen() {
  const router = useRouter();
  const { isAdmin, toggleAdmin } = useApp();
  const { t } = useLanguage();
  const [adminCode, setAdminCode] = React.useState('');

  const handleActivateAdmin = () => {
    if (adminCode === 'admin123') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toggleAdmin(true);
      Alert.alert(t('admin.activatedTitle'), t('admin.activatedMsg'));
      setAdminCode('');
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('admin.wrongCode'), t('admin.wrongCodeMsg'));
    }
  };

  const handleDeactivateAdmin = () => {
    Alert.alert(
      t('admin.deactivateTitle'),
      t('admin.deactivateMsg'),
      [
        { text: t('common.no'), style: 'cancel' },
        {
          text: t('common.yes'),
          onPress: () => {
            toggleAdmin(false);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: t('admin.title'),
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <ArrowLeft size={22} color={Colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.headerSection}>
        <View style={styles.adminIcon}>
          <Shield size={32} color={Colors.white} />
        </View>
        <Text style={styles.headerTitle}>{t('admin.panelTitle')}</Text>
        <Text style={styles.headerSubtitle}>
          {t('admin.panelDesc')}
        </Text>
      </View>

      {!isAdmin ? (
        <View style={styles.loginSection}>
          <Text style={styles.loginTitle}>{t('admin.accessTitle')}</Text>
          <Text style={styles.loginDesc}>
            {t('admin.accessDesc')}
          </Text>
          <View style={styles.codeInputGroup}>
            <Shield size={18} color={Colors.primary} />
            <TextInput
              style={styles.codeInput}
              placeholder={t('admin.codePlaceholder')}
              placeholderTextColor={Colors.textMuted}
              value={adminCode}
              onChangeText={setAdminCode}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity style={styles.activateBtn} onPress={handleActivateAdmin}>
            <Text style={styles.activateBtnText}>{t('admin.activate')}</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>{t('admin.hint')}</Text>
        </View>
      ) : (
        <>
          <View style={styles.statusBadge}>
            <Shield size={18} color={Colors.success} />
            <Text style={styles.statusText}>{t('admin.active')}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Shield size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>{t('admin.info')}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>{t('admin.howItWorks')}</Text>
              <Text style={styles.infoValue}>
                {t('admin.howItWorks')}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.deactivateBtn} onPress={handleDeactivateAdmin}>
            <Trash2 size={16} color={Colors.error} />
            <Text style={styles.deactivateBtnText}>{t('admin.deactivate')}</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 60,
  },
  headerBtn: {
    padding: 4,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 20,
  },
  adminIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900' as const,
    color: Colors.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loginSection: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 6,
  },
  loginDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  codeInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    marginBottom: 16,
    gap: 10,
  },
  codeInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: 14,
  },
  activateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  activateBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  hint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.success + '15',
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.success + '40',
    marginBottom: 20,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  section: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  infoCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  deactivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.error + '40',
  },
  deactivateBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.error,
  },
});

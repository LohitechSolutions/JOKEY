import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Lock, Eye, EyeOff, Shield, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useMutation } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
export default function ChangePasswordScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isAuthenticated, currentUser } = useApp();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const updatePasswordMutation = useMutation({
    mutationFn: async ({ currentPwd, newPwd }: { currentPwd: string; newPwd: string }) => {
      console.log('[ChangePassword] Updating password...');

      if (!isAuthenticated || !currentUser) {
        throw new Error('Vous devez être connecté pour changer votre mot de passe');
      }

      if (!isSupabaseConfigured) {
        console.log('[ChangePassword] Local mode: updating password locally');
        const { clientConfirmPasswordReset } = await import('@/lib/auth-client');
        await clientConfirmPasswordReset({ email: '', code: '', newPassword: newPwd });
        return { success: true };
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      console.log('[ChangePassword] Re-authenticating with current password...');
      const userEmail = sessionData.session.user.email;
      if (!userEmail) {
        throw new Error('Email introuvable dans la session');
      }

      const { error: reAuthError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPwd,
      });

      if (reAuthError) {
        console.error('[ChangePassword] Re-auth error:', reAuthError.message);
        throw new Error('Mot de passe actuel incorrect');
      }

      console.log('[ChangePassword] Re-auth success, updating password...');
      const { error } = await supabase.auth.updateUser({
        password: newPwd,
      });
      if (error) {
        console.error('[ChangePassword] Update error:', error.message);
        throw new Error(error.message);
      }
      return { success: true };
    },
    onSuccess: () => {
      console.log('[ChangePassword] Password updated successfully');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(
        t('settings.passwordUpdated'),
        t('settings.passwordUpdatedMsg'),
        [{ text: 'OK', onPress: () => router.back() }]
      );
    },
    onError: (error: Error) => {
      console.error('[ChangePassword] Error:', error.message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('settings.passwordError'), error.message || t('settings.passwordErrorMsg'));
    },
  });

  const handleSubmit = () => {
    if (!currentPassword.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre mot de passe actuel');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t('settings.passwordTooShort'), t('settings.passwordTooShortMsg'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('settings.passwordMismatch'), t('settings.passwordMismatchMsg'));
      return;
    }
    if (currentPassword === newPassword) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit être différent de l\'ancien');
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updatePasswordMutation.mutate({ currentPwd: currentPassword, newPwd: newPassword });
  };

  const isValid = currentPassword.length > 0 && newPassword.length >= 6 && newPassword === confirmPassword;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: t('settings.changePassword'),
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <ArrowLeft size={22} color={Colors.text} />
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Shield size={32} color={Colors.primary} />
            </View>
            <Text style={styles.title}>{t('settings.changePassword')}</Text>
            <Text style={styles.subtitle}>{t('settings.changePasswordDesc')}</Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <View style={styles.inputIcon}>
                <Lock size={20} color={Colors.warning} />
              </View>
              <TextInput
                style={styles.inputPassword}
                placeholder="Mot de passe actuel"
                placeholderTextColor={Colors.textMuted}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrent}
                autoCapitalize="none"
                testID="input-current-password"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowCurrent(!showCurrent)}>
                {showCurrent ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.inputGroup}>
              <View style={styles.inputIcon}>
                <Lock size={20} color={Colors.primary} />
              </View>
              <TextInput
                style={styles.inputPassword}
                placeholder={t('settings.newPassword')}
                placeholderTextColor={Colors.textMuted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                autoCapitalize="none"
                testID="input-new-password"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew(!showNew)}>
                {showNew ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputIcon}>
                <Check size={20} color={confirmPassword.length > 0 && newPassword === confirmPassword ? Colors.success : Colors.primary} />
              </View>
              <TextInput
                style={styles.inputPassword}
                placeholder={t('settings.confirmNewPassword')}
                placeholderTextColor={Colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                testID="input-confirm-password"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
              </TouchableOpacity>
            </View>

            {newPassword.length > 0 && newPassword.length < 6 && (
              <Text style={styles.hint}>{t('settings.passwordTooShortMsg')}</Text>
            )}
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <Text style={styles.hint}>{t('settings.passwordMismatchMsg')}</Text>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, (!isValid || updatePasswordMutation.isPending) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!isValid || updatePasswordMutation.isPending}
              testID="btn-update-password"
            >
              {updatePasswordMutation.isPending ? (
                <ActivityIndicator color={Colors.accent} />
              ) : (
                <Text style={styles.submitBtnText}>{t('settings.updatePassword')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  headerBtn: {
    padding: 4,
  },
  iconContainer: {
    alignItems: 'center' as const,
    marginBottom: 28,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.primary + '30',
  },
  title: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.primary,
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginTop: 6,
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  inputGroup: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    overflow: 'hidden' as const,
  },
  inputIcon: {
    width: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  inputPassword: {
    flex: 1,
    fontSize: 16,
    color: Colors.white,
    paddingVertical: 16,
  },
  eyeBtn: {
    padding: 14,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: 6,
    marginHorizontal: 8,
  },
  hint: {
    fontSize: 12,
    color: Colors.error,
    marginBottom: 10,
    marginLeft: 4,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center' as const,
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.accent,
    letterSpacing: 0.5,
  },
});

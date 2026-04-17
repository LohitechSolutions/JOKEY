import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { Stack } from 'expo-router';
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, Mic, Headphones } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LANGUAGE_OPTIONS } from '@/constants/translations';


type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export default function AuthScreen() {
  const { login, register, authError, isRegistering, isLoggingIn, requestPasswordReset, isRequestingReset } = useApp();
  const { t, language, changeLanguage } = useLanguage();
  const [mode, setMode] = useState<AuthMode>('register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'creator' | 'visitor' | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [_resetSent, setResetSent] = useState(false);

  const logoScale = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;



  useEffect(() => {
    Animated.sequence([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(formOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [logoScale, formOpacity]);



  useEffect(() => {
    if (authError) {
      Alert.alert(t('auth.error'), authError);
    }
  }, [authError, t]);

  const handleSubmit = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (mode === 'register') {
      if (!username.trim() || !email.trim() || !password.trim()) {
        Alert.alert(t('auth.fieldsRequired'), t('auth.fillAllFields'));
        return;
      }
      if (username.trim().length < 3) {
        Alert.alert(t('auth.usernameTooShort'), t('auth.usernameMin'));
        return;
      }
      if (!email.includes('@')) {
        Alert.alert(t('auth.invalidEmail'), t('auth.invalidEmailMsg'));
        return;
      }
      if (password.length < 6) {
        Alert.alert(t('auth.passwordTooShort'), t('auth.passwordMin'));
        return;
      }
      if (!selectedRole) {
        Alert.alert(t('auth.selectRole'), t('auth.selectRoleMsg'));
        return;
      }
      register({ username: username.trim(), email: email.trim(), password, role: selectedRole });
    } else if (mode === 'login') {
      if (!email.trim() || !password.trim()) {
        Alert.alert(t('auth.fieldsRequired'), t('auth.fillLogin'));
        return;
      }
      login({ email: email.trim(), password });
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim() || !resetEmail.includes('@')) {
      Alert.alert(t('auth.invalidEmail'), t('auth.invalidEmailMsg'));
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await requestPasswordReset(resetEmail.trim());
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResetSent(true);
      Alert.alert(
        t('auth.resetEmailSent'),
        t('auth.resetEmailSentMsg'),
        [{ text: 'OK' }]
      );
      setMode('reset');
    } catch (err: any) {
      Alert.alert(t('auth.error'), err.message || 'Erreur inconnue');
    }
  };


  const toggleMode = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode(mode === 'login' ? 'register' : 'login');
  };

  const isSubmitting = isRegistering || isLoggingIn;

  const renderForgotForm = () => (
    <Animated.View style={[styles.formCard, { opacity: formOpacity }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => setMode('login')}>
        <ArrowLeft size={20} color={Colors.primary} />
        <Text style={styles.backText}>{t('common.back')}</Text>
      </TouchableOpacity>

      <Text style={styles.formTitle}>{t('auth.forgotPassword')}</Text>
      <Text style={styles.formSubtitle}>{t('auth.forgotDescEmail')}</Text>

      <View style={styles.inputGroup}>
        <View style={styles.inputIcon}>
          <Mail size={20} color={Colors.primary} />
        </View>
        <TextInput
          style={styles.input}
          placeholder={t('auth.email')}
          placeholderTextColor={Colors.textMuted}
          value={resetEmail}
          onChangeText={setResetEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, isRequestingReset && styles.submitBtnDisabled]}
        onPress={handleForgotPassword}
        disabled={isRequestingReset}
      >
        {isRequestingReset ? (
          <ActivityIndicator color={Colors.accent} />
        ) : (
          <Text style={styles.submitBtnText}>{t('auth.sendCode')}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  const renderResetForm = () => (
    <Animated.View style={[styles.formCard, { opacity: formOpacity }]}>
      <View style={styles.emailSentContainer}>
        <View style={styles.emailSentIcon}>
          <Mail size={32} color={Colors.primary} />
        </View>
        <Text style={styles.formTitle}>{t('auth.resetEmailSent')}</Text>
        <Text style={styles.formSubtitle}>{t('auth.resetEmailSentMsg')}</Text>
      </View>

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={() => {
          setMode('login');
          setResetSent(false);
          setResetEmail('');
        }}
      >
        <Text style={styles.submitBtnText}>{t('auth.backToLogin')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.langSwitcher}>
            {LANGUAGE_OPTIONS.map((lang) => (
              <TouchableOpacity
                key={lang.id}
                style={[
                  styles.langBtn,
                  language === lang.id && styles.langBtnActive,
                ]}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  changeLanguage(lang.id);
                }}
                testID={`lang-${lang.id}`}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text
                  style={[
                    styles.langLabel,
                    language === lang.id && styles.langLabelActive,
                  ]}
                >
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Animated.View style={[styles.logoSection, { transform: [{ scale: logoScale }] }]}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>{t('auth.tagline')}</Text>
          </Animated.View>

          {mode === 'forgot' ? renderForgotForm() : mode === 'reset' ? renderResetForm() : (
            <Animated.View style={[styles.formCard, { opacity: formOpacity }]}>
              <Text style={styles.formTitle}>
                {mode === 'register' ? t('auth.createAccount') : t('auth.login')}
              </Text>
              <Text style={styles.formSubtitle}>
                {mode === 'register'
                  ? t('auth.joinCommunity')
                  : t('auth.welcomeBack')}
              </Text>

              {mode === 'register' && (
                <>
                  <View style={styles.inputGroup}>
                    <View style={styles.inputIcon}>
                      <User size={20} color={Colors.primary} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder={t('auth.username')}
                      placeholderTextColor={Colors.textMuted}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      testID="input-username"
                    />
                  </View>

                  <Text style={styles.roleLabel}>{t('auth.chooseRole')}</Text>
                  <View style={styles.roleRow}>
                    <TouchableOpacity
                      style={[styles.roleCard, selectedRole === 'creator' && styles.roleCardActive]}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedRole('creator');
                      }}
                      testID="role-creator"
                    >
                      <View style={[styles.roleIconBox, selectedRole === 'creator' && styles.roleIconBoxActive]}>
                        <Mic size={24} color={selectedRole === 'creator' ? Colors.white : Colors.accent} />
                      </View>
                      <Text style={[styles.roleTitle, selectedRole === 'creator' && styles.roleTitleActive]}>
                        {t('auth.roleCreator')}
                      </Text>
                      <Text style={styles.roleDesc}>{t('auth.roleCreatorDesc')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.roleCard, selectedRole === 'visitor' && styles.roleCardActive]}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedRole('visitor');
                      }}
                      testID="role-visitor"
                    >
                      <View style={[styles.roleIconBox, selectedRole === 'visitor' && styles.roleIconBoxActive]}>
                        <Headphones size={24} color={selectedRole === 'visitor' ? Colors.white : Colors.primary} />
                      </View>
                      <Text style={[styles.roleTitle, selectedRole === 'visitor' && styles.roleTitleActive]}>
                        {t('auth.roleVisitor')}
                      </Text>
                      <Text style={styles.roleDesc}>{t('auth.roleVisitorDesc')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <Mail size={20} color={Colors.primary} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.email')}
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="input-email"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <Lock size={20} color={Colors.primary} />
                </View>
                <TextInput
                  style={styles.inputPassword}
                  placeholder={t('auth.password')}
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  testID="input-password"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={Colors.textMuted} />
                  ) : (
                    <Eye size={20} color={Colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>

              {mode === 'login' && (
                <TouchableOpacity
                  style={styles.forgotBtn}
                  onPress={() => {
                    setMode('forgot');
                    setResetEmail(email);
                  }}
                >
                  <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                testID="btn-submit"
              >
                {isSubmitting ? (
                  <ActivityIndicator color={Colors.accent} />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {mode === 'register' ? t('auth.register') : t('auth.loginBtn')}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.switchBtn} onPress={toggleMode}>
                <Text style={styles.switchText}>
                  {mode === 'register'
                    ? t('auth.alreadyAccount')
                    : t('auth.noAccount')}
                  <Text style={styles.switchLink}>
                    {mode === 'register' ? t('auth.login') : t('auth.register')}
                  </Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 40,
  },
  logo: {
    width: 200,
    height: 200,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 28,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.primary,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  inputIcon: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.white,
    paddingVertical: 16,
    paddingRight: 16,
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
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  switchBtn: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  switchLink: {
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 8,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  langSwitcher: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 60,
    marginBottom: -16,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  langBtnActive: {
    backgroundColor: Colors.card,
    borderColor: Colors.primary + '60',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  langFlag: {
    fontSize: 18,
  },
  langLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  langLabelActive: {
    color: Colors.primary,
    fontWeight: '800' as const,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 10,
    textAlign: 'center' as const,
  },
  roleRow: {
    flexDirection: 'row' as const,
    gap: 12,
    marginBottom: 18,
  },
  roleCard: {
    flex: 1,
    alignItems: 'center' as const,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
  },
  roleCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '08',
  },
  roleIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  roleIconBoxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  roleTitleActive: {
    color: Colors.primary,
  },
  roleDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center' as const,
  },
  emailSentContainer: {
    alignItems: 'center' as const,
    marginBottom: 24,
  },
  emailSentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: Colors.primary + '30',
  },
});

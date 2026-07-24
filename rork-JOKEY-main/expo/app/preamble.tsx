import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter, Link } from 'expo-router';
import { Shield, Users, AlertTriangle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PreambleScreen() {
  const router = useRouter();
  const { acceptPreamble } = useApp();
  const { t } = useLanguage();
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const canContinue = ageConfirmed && termsAccepted;

  const handleAccept = async () => {
    if (!canContinue) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await acceptPreamble();
    router.replace('/auth');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.iconRow}>
          <View style={styles.iconCircle}>
            <Shield size={28} color={Colors.white} />
          </View>
        </View>

        <Text style={styles.title}>{t('preamble.title')}</Text>
        <Text style={styles.subtitle}>{t('preamble.subtitle')}</Text>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Users size={18} color={Colors.primary} />
            <Text style={styles.cardTitle}>{t('preamble.communityTitle')}</Text>
          </View>
          <Text style={styles.cardText}>{t('preamble.communityText')}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <AlertTriangle size={18} color={Colors.warning} />
            <Text style={styles.cardTitle}>{t('preamble.matureTitle')}</Text>
          </View>
          <Text style={styles.cardText}>{t('preamble.matureText')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('preamble.rulesTitle')}</Text>
          <Text style={styles.cardText}>{t('preamble.rulesText')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('preamble.safetyTitle')}</Text>
          <Text style={styles.cardText}>{t('preamble.safetyText')}</Text>
        </View>

        <View style={styles.linksRow}>
          <Link href="/terms" style={styles.link}>{t('preamble.termsLink')}</Link>
          <Text style={styles.linkSep}>·</Text>
          <Link href="/privacy" style={styles.link}>{t('preamble.privacyLink')}</Link>
        </View>

        <Text style={styles.adultWarning}>{t('preamble.adultWarning')}</Text>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAgeConfirmed(!ageConfirmed)}
        >
          <View style={[styles.checkbox, ageConfirmed && styles.checkboxChecked]}>
            {ageConfirmed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>{t('preamble.ageConfirm')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setTermsAccepted(!termsAccepted)}
        >
          <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
            {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>{t('preamble.termsConfirm')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.acceptBtn, !canContinue && styles.acceptBtnDisabled]}
          onPress={handleAccept}
          disabled={!canContinue}
        >
          <Text style={styles.acceptBtnText}>{t('preamble.accept')}</Text>
        </TouchableOpacity>

        <Text style={styles.contact}>{t('preamble.contact')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  cardText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 16,
  },
  link: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600' as const,
    textDecorationLine: 'underline',
  },
  linkSep: {
    color: Colors.textMuted,
  },
  adultWarning: {
    fontSize: 14,
    color: Colors.warning,
    lineHeight: 20,
    marginBottom: 14,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  acceptBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  acceptBtnDisabled: {
    opacity: 0.5,
  },
  acceptBtnText: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: Colors.accent,
  },
  contact: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});

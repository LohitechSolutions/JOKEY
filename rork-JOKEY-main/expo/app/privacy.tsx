import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Shield } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PrivacyScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: t('privacy.title'),
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <ArrowLeft size={22} color={Colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.iconSection}>
        <View style={styles.iconCircle}>
          <Shield size={32} color={Colors.white} />
        </View>
        <Text style={styles.pageTitle}>{t('privacy.title')}</Text>
        <Text style={styles.lastUpdated}>{t('privacy.lastUpdated')}: 2026-03-01</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('privacy.collectTitle')}</Text>
        <Text style={styles.sectionText}>{t('privacy.collectText')}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('privacy.useTitle')}</Text>
        <Text style={styles.sectionText}>{t('privacy.useText')}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('privacy.shareTitle')}</Text>
        <Text style={styles.sectionText}>{t('privacy.shareText')}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('privacy.securityTitle')}</Text>
        <Text style={styles.sectionText}>{t('privacy.securityText')}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('privacy.rightsTitle')}</Text>
        <Text style={styles.sectionText}>{t('privacy.rightsText')}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('privacy.contactTitle')}</Text>
        <Text style={styles.sectionText}>{t('privacy.contactText')}</Text>
      </View>
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
  iconSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '900' as const,
    color: Colors.primary,
  },
  lastUpdated: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  section: {
    marginHorizontal: 20,
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primaryDark,
    marginBottom: 10,
  },
  sectionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});

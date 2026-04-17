import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Crown, Check, Zap, Star, Infinity as InfinityIcon, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SubscriptionPlan } from '@/types';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { isSubscribed, subscribe, currentUser, listenCount, createCount } = useApp();
  const { t } = useLanguage();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('weekly');

  const handleSubscribe = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const confirmMsg = selectedPlan === 'weekly' ? t('sub.confirmWeekly') : t('sub.confirmMonthly');
    Alert.alert(
      t('sub.confirmTitle'),
      confirmMsg,
      [
        { text: t('sub.cancel'), style: 'cancel' },
        {
          text: t('sub.subscribeBtn'),
          onPress: () => {
            subscribe(true, selectedPlan);
            Alert.alert(t('sub.welcomePremium'), t('sub.welcomeMsg'));
          },
        },
      ]
    );
  };

  const handleUnsubscribe = () => {
    Alert.alert(
      t('sub.cancelTitle'),
      t('sub.cancelMsg'),
      [
        { text: t('sub.no'), style: 'cancel' },
        {
          text: t('sub.yesCancel'),
          style: 'destructive',
          onPress: () => {
            subscribe(false);
            Alert.alert(t('sub.cancelledTitle'), t('sub.cancelledMsg'));
          },
        },
      ]
    );
  };

  const isCreator = currentUser?.role === 'creator';
  const usageText = isCreator
    ? t('sub.creatorLimit').replace('{n}', createCount.toString())
    : t('sub.visitorLimit').replace('{n}', listenCount.toString());

  const features = [
    { icon: <InfinityIcon size={22} color="#1565C0" />, title: t('sub.unlimited'), desc: t('sub.unlimitedDesc') },
    { icon: <Zap size={22} color="#1565C0" />, title: t('sub.priority'), desc: t('sub.priorityDesc') },
    { icon: <Star size={22} color="#1565C0" />, title: t('sub.badge'), desc: t('sub.badgeDesc') },
    { icon: <Heart size={22} color="#1565C0" />, title: t('sub.support'), desc: t('sub.supportDesc') },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: t('sub.title'),
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <ArrowLeft size={22} color={Colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.heroSection}>
        <View style={styles.crownCircle}>
          <Crown size={48} color="#F5A623" fill="#F5A623" />
        </View>
        <Text style={styles.heroTitle}>{t('sub.heroTitle')}</Text>
        <Text style={styles.heroSubtitle}>{t('sub.heroSubtitle')}</Text>
      </View>

      {isSubscribed && (
        <View style={styles.activeBadge}>
          <Check size={20} color={Colors.success} />
          <Text style={styles.activeText}>{t('sub.active')}</Text>
        </View>
      )}

      {!isSubscribed && (
        <View style={styles.usageBanner}>
          <Text style={styles.usageText}>{usageText}</Text>
          <View style={styles.usageBar}>
            <View
              style={[
                styles.usageFill,
                {
                  width: `${Math.min(((isCreator ? createCount : listenCount) / (isCreator ? 5 : 8)) * 100, 100)}%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      <View style={styles.featuresSection}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureCard}>
            <View style={styles.featureIconBox}>
              {feature.icon}
            </View>
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDesc}>{feature.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {!isSubscribed && (
        <>
          <View style={styles.plansRow}>
            <TouchableOpacity
              style={[styles.planCard, selectedPlan === 'weekly' && styles.planCardActive]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedPlan('weekly');
              }}
            >
              <Text style={[styles.planLabel, selectedPlan === 'weekly' && styles.planLabelActive]}>
                {t('sub.weekly')}
              </Text>
              <Text style={[styles.planPeriod, selectedPlan === 'weekly' && styles.planPeriodActive]}>
                {t('sub.perWeek')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardActive]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedPlan('monthly');
              }}
            >
              <View style={styles.bestValueBadge}>
                <Text style={styles.bestValueText}>{t('sub.bestValue')}</Text>
              </View>
              <Text style={[styles.planLabel, selectedPlan === 'monthly' && styles.planLabelActive]}>
                {t('sub.monthly')}
              </Text>
              <Text style={[styles.planPeriod, selectedPlan === 'monthly' && styles.planPeriodActive]}>
                {t('sub.perMonth')}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cancelNote}>{t('sub.cancelAnytime')}</Text>

          <TouchableOpacity style={styles.subscribeBtn} onPress={handleSubscribe}>
            <Crown size={20} color={Colors.accent} />
            <Text style={styles.subscribeBtnText}>{t('sub.subscribe')}</Text>
          </TouchableOpacity>
        </>
      )}

      {isSubscribed && (
        <TouchableOpacity style={styles.unsubscribeBtn} onPress={handleUnsubscribe}>
          <Text style={styles.unsubscribeBtnText}>{t('sub.unsubscribe')}</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.disclaimer}>{t('sub.disclaimer')}</Text>
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
  heroSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
  },
  crownCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900' as const,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.success + '15',
    marginHorizontal: 24,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.success + '40',
    marginBottom: 16,
  },
  activeText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  usageBanner: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  usageText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  usageBar: {
    height: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  usageFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 4,
  },
  featuresSection: {
    marginHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    gap: 14,
  },
  featureIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1565C0',
  },
  featureDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  plansRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    gap: 12,
    marginBottom: 12,
  },
  planCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.cardBorder,
  },
  planCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '08',
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  bestValueText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: Colors.white,
    textTransform: 'uppercase' as const,
  },
  planLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  planLabelActive: {
    color: Colors.primary,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '900' as const,
    color: Colors.textSecondary,
  },
  planPriceActive: {
    color: Colors.primary,
  },
  planPeriod: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginLeft: 2,
  },
  planPeriodActive: {
    color: Colors.primary,
  },
  cancelNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 18,
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  subscribeBtnText: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.accent,
  },
  unsubscribeBtn: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.error + '40',
  },
  unsubscribeBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.error,
  },
  disclaimer: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginHorizontal: 40,
    marginTop: 20,
    lineHeight: 16,
  },
});

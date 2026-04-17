import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FeedTab } from '@/types';
import Colors from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';

interface FeedTabBarProps {
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
}

const TAB_KEYS: { id: FeedTab; tKey: string; emoji: string }[] = [
  { id: 'jour', tKey: 'feed.day', emoji: '🔥' },
  { id: 'nouveautes', tKey: 'feed.new', emoji: '✨' },
  { id: 'tendances', tKey: 'feed.trending', emoji: '📈' },
  { id: 'abonnements', tKey: 'feed.subscriptions', emoji: '👥' },
];

export default React.memo(function FeedTabBar({ activeTab, onTabChange }: FeedTabBarProps) {
  const { t } = useLanguage();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {TAB_KEYS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onTabChange(tab.id);
            }}
            testID={`feed-tab-${tab.id}`}
          >
            <Text style={styles.tabEmoji}>{tab.emoji}</Text>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {t(tab.tKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    gap: 6,
  },
  tabActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabEmoji: {
    fontSize: 14,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.white,
  },
});

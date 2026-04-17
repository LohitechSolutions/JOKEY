import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { Shuffle, ChevronDown, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { FeedTab } from '@/types';
import JokeCard from '@/components/JokeCard';

const FEED_TABS: { id: FeedTab; tKey: string; emoji: string }[] = [
  { id: 'jour', tKey: 'feed.day', emoji: '🔥' },
  { id: 'nouveautes', tKey: 'feed.new', emoji: '✨' },
  { id: 'tendances', tKey: 'feed.trending', emoji: '📈' },
  { id: 'abonnements', tKey: 'feed.subscriptions', emoji: '👥' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { jokes, followingIds } = useApp();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<FeedTab>('jour');
  const [refreshing, setRefreshing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredJokes = useMemo(() => {
    switch (activeTab) {
      case 'jour':
        return jokes.filter(j => j.isJokeOfDay || j.isTrending).slice(0, 5);
      case 'nouveautes':
        return [...jokes].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case 'tendances':
        return [...jokes].sort((a, b) => {
          const aTotal = Object.values(a.reactions).reduce((s, c) => s + c, 0);
          const bTotal = Object.values(b.reactions).reduce((s, c) => s + c, 0);
          return bTotal - aTotal;
        });
      case 'abonnements':
        return jokes.filter(j => followingIds.includes(j.userId));
      default:
        return jokes;
    }
  }, [activeTab, jokes, followingIds]);

  const { refreshJokes } = useApp();

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    try {
      refreshJokes();
    } catch (err) {
      console.warn('[Home] Refresh error:', err);
    } finally {
      setTimeout(() => setRefreshing(false), 1000);
    }
  }, [refreshJokes]);

  const handleSurprise = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleSelectTab = useCallback((tab: FeedTab) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    setShowDropdown(false);
  }, []);

  const activeTabInfo = FEED_TABS.find(t => t.id === activeTab);

  const renderHeader = useCallback(() => (
    <View style={{ paddingTop: insets.top }}>
      <View style={styles.logoContainer}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logoLarge}
          resizeMode="contain"
        />
      </View>
      <View style={styles.welcomeBanner}>
        <View style={styles.welcomeContent}>
          <Text style={styles.welcomeEmoji}>🎙️</Text>
          <View style={styles.welcomeText}>
            <Text style={styles.welcomeTitle}>{t('home.welcome')}</Text>
            <Text style={styles.welcomeSubtitle}>{t('home.subtitle')}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.surpriseBtn} onPress={handleSurprise}>
          <Shuffle size={18} color={Colors.primary} />
          <Text style={styles.surpriseBtnText}>{t('home.surprise')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dropdownSection}>
        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={() => setShowDropdown(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.dropdownEmoji}>{activeTabInfo?.emoji}</Text>
          <Text style={styles.dropdownLabel}>{activeTabInfo ? t(activeTabInfo.tKey) : ''}</Text>
          <ChevronDown size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  ), [handleSurprise, t, insets.top, activeTabInfo]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🎧</Text>
      <Text style={styles.emptyTitle}>{t('home.empty.title')}</Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'abonnements'
          ? t('home.empty.subscriptions')
          : t('home.empty.default')}
      </Text>
    </View>
  ), [activeTab, t]);

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredJokes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <JokeCard joke={item} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      />

      <Modal
        visible={showDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDropdown(false)}>
          <View style={styles.dropdownMenu}>
            <Text style={styles.dropdownMenuTitle}>Sélectionner une rubrique</Text>
            {FEED_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                  onPress={() => handleSelectTab(tab.id)}
                >
                  <Text style={styles.dropdownItemEmoji}>{tab.emoji}</Text>
                  <Text style={[styles.dropdownItemLabel, isActive && styles.dropdownItemLabelActive]}>
                    {t(tab.tKey)}
                  </Text>
                  {isActive && <Check size={18} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingBottom: 100,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  logoLarge: {
    width: 260,
    height: 260,
  },
  welcomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    borderRadius: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  welcomeEmoji: {
    fontSize: 32,
  },
  welcomeText: {
    marginLeft: 12,
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  surpriseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,213,79,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  surpriseBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  dropdownSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  dropdownEmoji: {
    fontSize: 18,
  },
  dropdownLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  dropdownMenu: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 15,
  },
  dropdownMenuTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 12,
    marginBottom: 4,
  },
  dropdownItemActive: {
    backgroundColor: Colors.primary + '15',
  },
  dropdownItemEmoji: {
    fontSize: 20,
  },
  dropdownItemLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  dropdownItemLabelActive: {
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

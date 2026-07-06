import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ImageJokeCard from '@/components/ImageJokeCard';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { imageJokes, refreshImageJokes } = useApp();
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshImageJokes();
    setTimeout(() => setRefreshing(false), 800);
  }, [refreshImageJokes]);

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
        <Text style={styles.welcomeEmoji}>🎨</Text>
        <View style={styles.welcomeText}>
          <Text style={styles.welcomeTitle}>{t('home.welcome')}</Text>
          <Text style={styles.welcomeSubtitle}>{t('home.subtitle')}</Text>
        </View>
      </View>
    </View>
  ), [insets.top, t]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🖼️</Text>
      <Text style={styles.emptyTitle}>{t('home.empty.title')}</Text>
      <Text style={styles.emptySubtitle}>{t('home.empty.default')}</Text>
    </View>
  ), [t]);

  return (
    <View style={styles.container}>
      <FlatList
        data={imageJokes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ImageJokeCard joke={item} />}
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
    flexGrow: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  logoLarge: {
    width: 220,
    height: 220,
  },
  welcomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    gap: 14,
  },
  welcomeEmoji: {
    fontSize: 36,
  },
  welcomeText: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '900' as const,
    color: Colors.primary,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 40,
    paddingBottom: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

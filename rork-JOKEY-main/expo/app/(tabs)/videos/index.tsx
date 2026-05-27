import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
} from 'react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Video } from '@/types';
import VideoCard from '@/components/VideoCard';

export default function VideosScreen() {
  const { videos, refreshVideos } = useApp();
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);

  const sortedVideos = useMemo(() => {
    return [...videos].sort((a: Video, b: Video) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [videos]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    try {
      refreshVideos();
    } catch (err) {
      console.warn('[Videos] Refresh error:', err);
    } finally {
      setTimeout(() => setRefreshing(false), 1000);
    }
  }, [refreshVideos]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🎬</Text>
      <Text style={styles.emptyTitle}>{t('videos.empty.title')}</Text>
      <Text style={styles.emptySubtitle}>{t('videos.empty.default')}</Text>
    </View>
  ), [t]);

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedVideos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <VideoCard video={item} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>🎬</Text>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>{t('videos.title')}</Text>
              <Text style={styles.headerSubtitle}>{t('videos.subtitle')}</Text>
            </View>
          </View>
        }
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    borderRadius: 20,
  },
  headerEmoji: {
    fontSize: 34,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 70,
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 52,
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

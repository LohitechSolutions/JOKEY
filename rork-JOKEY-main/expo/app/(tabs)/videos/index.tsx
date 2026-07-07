import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { JokeCategory, CategoryInfo } from '@/types';
import VideoCard from '@/components/VideoCard';
import { CATEGORIES } from '@/mocks/data';

export default function VideosScreen() {
  const { visibleVideos, refreshVideos } = useApp();
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<JokeCategory | null>(null);

  const videoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    visibleVideos.forEach(v => {
      counts[v.category] = (counts[v.category] || 0) + 1;
    });
    return counts;
  }, [visibleVideos]);

  const categoryVideos = useMemo(() => {
    if (!selectedCategory) return [];
    return [...visibleVideos]
      .filter(v => v.category === selectedCategory)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [selectedCategory, visibleVideos]);

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

  const handleBack = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  const renderCategory = useCallback(({ item }: { item: CategoryInfo }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => setSelectedCategory(item.id)}
      activeOpacity={0.8}
    >
      <View style={[styles.categoryIcon, { backgroundColor: item.color + '18' }]}>
        <Text style={styles.categoryEmoji}>{item.emoji}</Text>
      </View>
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName}>{t(`cat.${item.id}`)}</Text>
        <Text style={styles.categoryDesc}>{t(`cat.${item.id}.desc`)}</Text>
      </View>
      <View style={styles.categoryRight}>
        <Text style={[styles.categoryCount, { color: item.color }]}>
          {videoCounts[item.id] || 0}
        </Text>
        <ChevronRight size={18} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  ), [videoCounts, t]);

  if (selectedCategory) {
    const cat = CATEGORIES.find(c => c.id === selectedCategory);
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backRow} onPress={handleBack}>
          <Text style={styles.backText}>{t('categories.back')}</Text>
        </TouchableOpacity>
        {cat && (
          <View style={[styles.catHeader, { backgroundColor: cat.color + '15' }]}>
            <Text style={styles.catHeaderEmoji}>{cat.emoji}</Text>
            <Text style={[styles.catHeaderName, { color: cat.color }]}>{t(`cat.${cat.id}`)}</Text>
            <Text style={styles.catHeaderDesc}>{t(`cat.${cat.id}.desc`)}</Text>
          </View>
        )}
        <FlatList
          data={categoryVideos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <VideoCard video={item} />}
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
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎬</Text>
              <Text style={styles.emptyTitle}>{t('videos.empty.title')}</Text>
              <Text style={styles.emptySubtitle}>{t('videos.empty.default')}</Text>
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={CATEGORIES}
        keyExtractor={(item) => item.id}
        renderItem={renderCategory}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>🎬</Text>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>{t('videos.title')}</Text>
              <Text style={styles.headerSubtitle}>{t('videos.subtitle')}</Text>
            </View>
          </View>
        }
        contentContainerStyle={styles.gridContent}
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
  gridContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 100,
  },
  listContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  categoryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: {
    fontSize: 24,
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 14,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  categoryDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryCount: {
    fontSize: 16,
    fontWeight: '800' as const,
  },
  backRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  catHeader: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  catHeaderEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  catHeaderName: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  catHeaderDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
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

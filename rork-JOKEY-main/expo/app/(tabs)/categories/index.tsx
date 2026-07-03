import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { CATEGORIES } from '@/mocks/data';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { JokeCategory, CategoryInfo } from '@/types';
import JokeCard from '@/components/JokeCard';

export default function CategoriesScreen() {
  const { visibleJokes } = useApp();
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<JokeCategory | null>(null);

  const categoryJokes = useMemo(() => {
    if (!selectedCategory) return [];
    return visibleJokes.filter(j => j.category === selectedCategory);
  }, [selectedCategory, visibleJokes]);

  const jokeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    visibleJokes.forEach(j => {
      counts[j.category] = (counts[j.category] || 0) + 1;
    });
    return counts;
  }, [visibleJokes]);

  const handleBack = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  const renderCategory = useCallback(({ item }: { item: CategoryInfo }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => setSelectedCategory(item.id)}
      activeOpacity={0.8}
      testID={`category-${item.id}`}
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
          {jokeCounts[item.id] || 0}
        </Text>
        <ChevronRight size={18} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  ), [jokeCounts, t]);

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
          data={categoryJokes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <JokeCard joke={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🔇</Text>
              <Text style={styles.emptyText}>{t('categories.empty')}</Text>
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
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
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
    paddingTop: 40,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
});

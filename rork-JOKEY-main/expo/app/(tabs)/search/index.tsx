import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Search as SearchIcon, TrendingUp, Users, Hash } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import JokeCard from '@/components/JokeCard';
import { useRouter } from 'expo-router';
import { User } from '@/types';

type SearchTab = 'blagues' | 'createurs' | 'tags';

export default function SearchScreen() {
  const router = useRouter();
  const { jokes } = useApp();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('blagues');

  const filteredJokes = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return jokes.filter(j =>
      j.title.toLowerCase().includes(q) ||
      j.tags.some(t => t.toLowerCase().includes(q)) ||
      j.user.displayName.toLowerCase().includes(q) ||
      j.category.includes(q)
    );
  }, [query, jokes]);

  const allUsers = useMemo(() => {
    const userMap = new Map<string, User>();
    jokes.forEach(j => {
      if (j.user && !userMap.has(j.userId)) {
        userMap.set(j.userId, j.user);
      }
    });
    return Array.from(userMap.values());
  }, [jokes]);

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return allUsers.slice(0, 5);
    const q = query.toLowerCase();
    return allUsers.filter(u =>
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    );
  }, [query, allUsers]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    jokes.forEach(j => j.tags.forEach(t => tagSet.add(t)));
    const tags = Array.from(tagSet);
    if (!query.trim()) return tags;
    return tags.filter(t => t.toLowerCase().includes(query.toLowerCase()));
  }, [jokes, query]);

  const trendingJokes = useMemo(() => {
    return [...jokes]
      .sort((a, b) => {
        const aT = Object.values(a.reactions).reduce((s, c) => s + c, 0);
        const bT = Object.values(b.reactions).reduce((s, c) => s + c, 0);
        return bT - aT;
      })
      .slice(0, 3);
  }, [jokes]);

  const handleUserPress = useCallback((userId: string) => {
    router.push(`/user/${userId}`);
  }, [router]);

  const renderSearchContent = () => {
    if (!query.trim()) {
      return (
        <View style={styles.discoverSection}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>{t('search.trending')}</Text>
          </View>
          {trendingJokes.map(joke => (
            <JokeCard key={joke.id} joke={joke} compact />
          ))}

          <View style={[styles.sectionHeader, { marginTop: 24 }]}>
            <Users size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>{t('search.popularCreators')}</Text>
          </View>
          {allUsers.slice(0, 4).map(user => (
            <TouchableOpacity
              key={user.id}
              style={styles.userRow}
              onPress={() => handleUserPress(user.id)}
            >
              <Image source={{ uri: user.avatar }} style={styles.userAvatar} />
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.displayName}</Text>
                <Text style={styles.userMeta}>@{user.username} · {user.jokesCount} blagues</Text>
              </View>
              <Text style={styles.followerCount}>{user.followersCount}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    switch (activeTab) {
      case 'blagues':
        return (
          <FlatList
            data={filteredJokes}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <JokeCard joke={item} compact />}
            contentContainerStyle={styles.resultsList}
            ListEmptyComponent={() => (
              <View style={styles.emptyResult}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyText}>{t('search.noJokes')}</Text>
              </View>
            )}
          />
        );
      case 'createurs':
        return (
          <FlatList
            data={filteredUsers}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.userRow}
                onPress={() => handleUserPress(item.id)}
              >
                <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.displayName}</Text>
                  <Text style={styles.userMeta}>@{item.username} · {item.jokesCount} blagues</Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.resultsList}
            ListEmptyComponent={() => (
              <View style={styles.emptyResult}>
                <Text style={styles.emptyText}>{t('search.noCreators')}</Text>
              </View>
            )}
          />
        );
      case 'tags':
        return (
          <View style={styles.tagsGrid}>
            {allTags.map(tag => (
              <TouchableOpacity key={tag} style={styles.tagChip}>
                <Hash size={14} color={Colors.primary} />
                <Text style={styles.tagText}>{tag}</Text>
              </TouchableOpacity>
            ))}
            {allTags.length === 0 && (
              <View style={styles.emptyResult}>
                <Text style={styles.emptyText}>{t('search.noTags')}</Text>
              </View>
            )}
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <SearchIcon size={20} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('search.placeholder')}
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          testID="search-input"
        />
      </View>

      {query.trim().length > 0 && (
        <View style={styles.tabRow}>
          {(['blagues', 'createurs', 'tags'] as SearchTab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.searchTab, activeTab === tab && styles.searchTabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.searchTabText, activeTab === tab && styles.searchTabTextActive]}>
                {tab === 'blagues' ? t('search.jokes') : tab === 'createurs' ? t('search.creators') : t('search.tags')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.content}>
        {renderSearchContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.white,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  searchTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  searchTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  searchTabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  searchTabTextActive: {
    color: Colors.accent,
  },
  content: {
    flex: 1,
    paddingTop: 12,
  },
  discoverSection: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  userMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  followerCount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 100,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    gap: 6,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  emptyResult: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
});

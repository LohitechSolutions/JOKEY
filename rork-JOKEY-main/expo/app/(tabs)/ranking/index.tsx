import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Star, Play, Pause, Clock, Trophy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Joke } from '@/types';
import { useRouter } from 'expo-router';

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const filled = i <= Math.round(rating);
    stars.push(
      <Star
        key={i}
        size={size}
        color={filled ? '#F5A623' : Colors.textMuted}
        fill={filled ? '#F5A623' : 'transparent'}
      />
    );
  }
  return <View style={starStyles.row}>{stars}</View>;
}

const starStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
});

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function RankingScreen() {
  const router = useRouter();
  const { jokes, playingJokeId, setPlayingJokeId, rateJoke, getMyRating } = useApp();
  const { t } = useLanguage();

  const rankedJokes = useMemo(() => {
    return [...jokes]
      .sort((a, b) => b.averageRating - a.averageRating || b.totalRatings - a.totalRatings)
      .slice(0, 100);
  }, [jokes]);

  const handlePlay = useCallback((jokeId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (playingJokeId === jokeId) {
      setPlayingJokeId(null);
    } else {
      setPlayingJokeId(jokeId);
    }
  }, [playingJokeId, setPlayingJokeId]);

  const handleRate = useCallback((jokeId: string, rating: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    rateJoke({ jokeId, rating });
  }, [rateJoke]);

  const renderPodium = useCallback(() => {
    if (rankedJokes.length < 3) return null;
    const top3 = rankedJokes.slice(0, 3);
    return (
      <View style={styles.podiumSection}>
        <View style={styles.podiumHeader}>
          <Trophy size={24} color={Colors.secondary} />
          <Text style={styles.podiumTitle}>{t('ranking.podium')}</Text>
        </View>
        {top3.map((joke, index) => {
          const medals = ['🥇', '🥈', '🥉'];
          return (
            <TouchableOpacity
              key={joke.id}
              style={styles.podiumCard}
              onPress={() => router.push(`/joke/${joke.id}`)}
              activeOpacity={0.85}
            >
              <Text style={styles.medal}>{medals[index]}</Text>
              <Image source={{ uri: joke.user.avatar }} style={styles.podiumAvatar} />
              <View style={styles.podiumInfo}>
                <Text style={styles.podiumJokeTitle} numberOfLines={1}>{joke.title}</Text>
                <Text style={styles.podiumCreator}>@{joke.user.username}</Text>
                <View style={styles.podiumRating}>
                  <StarRating rating={joke.averageRating} size={12} />
                  <Text style={styles.podiumRatingText}>{joke.averageRating.toFixed(1)}</Text>
                  <Text style={styles.podiumVotes}>({joke.totalRatings})</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.miniPlayBtn, playingJokeId === joke.id && styles.miniPlayBtnActive]}
                onPress={() => handlePlay(joke.id)}
              >
                {playingJokeId === joke.id ? (
                  <Pause size={16} color={Colors.white} fill={Colors.white} />
                ) : (
                  <Play size={16} color={Colors.white} fill={Colors.white} />
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }, [rankedJokes, playingJokeId, handlePlay, router, t]);

  const renderJokeRow = useCallback(({ item, index }: { item: Joke; index: number }) => {
    if (index < 3) return null;
    const rank = index + 1;
    const myRating = getMyRating(item.id);

    return (
      <TouchableOpacity
        style={styles.jokeRow}
        onPress={() => router.push(`/joke/${item.id}`)}
        activeOpacity={0.85}
      >
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
        <Image source={{ uri: item.user.avatar }} style={styles.rowAvatar} />
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.rowCreator}>@{item.user.username}</Text>
          <View style={styles.rowRatingRow}>
            <StarRating rating={item.averageRating} size={11} />
            <Text style={styles.rowRatingValue}>{item.averageRating.toFixed(1)}</Text>
            <Text style={styles.rowVotes}>({item.totalRatings})</Text>
          </View>
          <View style={styles.userRatingRow}>
            <Text style={styles.yourRateLabel}>{t('ranking.yourRating')}</Text>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity key={star} onPress={() => handleRate(item.id, star)}>
                <Star
                  size={18}
                  color={star <= myRating ? '#F5A623' : Colors.cardBorder}
                  fill={star <= myRating ? '#F5A623' : 'transparent'}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.rowRight}>
          <View style={styles.durationTag}>
            <Clock size={10} color={Colors.textMuted} />
            <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.miniPlayBtn, playingJokeId === item.id && styles.miniPlayBtnActive]}
            onPress={() => handlePlay(item.id)}
          >
            {playingJokeId === item.id ? (
              <Pause size={14} color={Colors.white} fill={Colors.white} />
            ) : (
              <Play size={14} color={Colors.white} fill={Colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [playingJokeId, handlePlay, handleRate, getMyRating, router, t]);

  return (
    <View style={styles.container}>
      <FlatList
        data={rankedJokes}
        keyExtractor={(item) => item.id}
        renderItem={renderJokeRow}
        ListHeaderComponent={renderPodium}
        contentContainerStyle={styles.listContent}
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
  listContent: {
    paddingBottom: 100,
  },
  podiumSection: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  podiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  podiumTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  podiumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary + '20',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  medal: {
    fontSize: 28,
    marginRight: 10,
  },
  podiumAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.secondary + '40',
  },
  podiumInfo: {
    flex: 1,
    marginLeft: 12,
  },
  podiumJokeTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  podiumCreator: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  podiumRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  podiumRatingText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  podiumVotes: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  jokeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  rowAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
  },
  rowInfo: {
    flex: 1,
    marginLeft: 10,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  rowCreator: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  rowRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  rowRatingValue: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  rowVotes: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  userRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  yourRateLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  rowRight: {
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  durationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  durationText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  miniPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniPlayBtnActive: {
    backgroundColor: '#1565C0',
  },
});

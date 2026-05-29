import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  Share,
  Platform,
  Alert,
} from 'react-native';
import { Play, Pause, MessageCircle, Share2, Clock, Star, Volume2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Joke, ReactionEmoji } from '@/types';
import { REACTION_EMOJIS, CATEGORIES } from '@/mocks/data';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'expo-router';

interface JokeCardProps {
  joke: Joke;
  onPlay?: () => void;
  compact?: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

function timeAgo(dateStr: string, tFn: (key: string, params?: Record<string, string | number>) => string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return tFn('common.now');
  if (diffHours < 24) return tFn('common.hoursAgo', { n: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return tFn('common.daysAgo', { n: diffDays });
  return tFn('common.weeksAgo', { n: Math.floor(diffDays / 7) });
}

export default React.memo(function JokeCard({ joke, onPlay, compact }: JokeCardProps) {
  const router = useRouter();
  const {
    playingJokeId,
    playJoke,
    pauseAudio,
    globalAudioStatus,
    addReaction,
    getJokeReactions,
    rateJoke,
    getMyRating,
    incrementListenCount,
  } = useApp();
  const { t } = useLanguage();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const myReactions = getJokeReactions(joke.id);
  const myRating = getMyRating(joke.id);
  const category = CATEGORIES.find(c => c.id === joke.category);

  // This card is the one currently playing
  const isThisJokePlaying = playingJokeId === joke.id;
  const isActive = isThisJokePlaying && globalAudioStatus.playing;

  // Progress only shown for the active card
  const progressPercent = isThisJokePlaying && globalAudioStatus.duration > 0
    ? (globalAudioStatus.currentTime / globalAudioStatus.duration) * 100
    : 0;

  const handlePlay = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isThisJokePlaying && globalAudioStatus.playing) {
      pauseAudio();
    } else {
      playJoke(joke);
      incrementListenCount();
    }
    onPlay?.();
  }, [isThisJokePlaying, globalAudioStatus.playing, playJoke, pauseAudio, joke, onPlay, incrementListenCount]);

  const handleReaction = useCallback((emoji: ReactionEmoji) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.2, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    addReaction({ jokeId: joke.id, emoji });
  }, [joke.id, addReaction, scaleAnim]);

  const handleRate = useCallback((rating: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rateJoke({ jokeId: joke.id, rating });
  }, [joke.id, rateJoke]);

  const handleCardPress = useCallback(() => {
    router.push(`/joke/${joke.id}`);
  }, [joke.id, router]);

  const handleUserPress = useCallback(() => {
    router.push(`/user/${joke.userId}`);
  }, [joke.userId, router]);

  const handleShare = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const message = `${t('joke.shareMsg')}\n\n"${joke.title}" par @${joke.user.username}\n⭐ ${joke.averageRating.toFixed(1)}/5 (${joke.totalRatings} votes)\n\n${t('joke.downloadJokey')}`;
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title: joke.title, text: message });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(message);
          Alert.alert(t('joke.copied'), t('joke.copiedMsg'));
        }
      } else {
        await Share.share({ message, title: `Jokey - ${joke.title}` });
      }
    } catch (error) {
      console.log('[JokeCard] Share error:', error);
    }
  }, [joke, t]);

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      onPress={handleCardPress}
      activeOpacity={0.95}
      testID={`joke-card-${joke.id}`}
    >
      {joke.isJokeOfDay && (
        <View style={styles.jokeOfDayBadge}>
          <Text style={styles.jokeOfDayText}>{t('jokeCard.jokeOfDay')}</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} onPress={handleUserPress}>
          <Image source={{ uri: joke.user.avatar }} style={styles.avatar} />
          <View style={styles.userText}>
            <Text style={styles.displayName} numberOfLines={1}>{joke.user.displayName}</Text>
            <Text style={styles.meta}>@{joke.user.username} · {timeAgo(joke.createdAt, t)}</Text>
          </View>
        </TouchableOpacity>
        {category && (
          <View style={[styles.categoryBadge, { backgroundColor: category.color + '18' }]}>
            <Text style={styles.categoryEmoji}>{category.emoji}</Text>
            <Text style={[styles.categoryName, { color: category.color }]}>{category.name}</Text>
          </View>
        )}
      </View>

      {joke.title ? (
        <Text style={styles.title} numberOfLines={2}>{joke.title}</Text>
      ) : null}

      <View style={styles.playerSection}>
        <TouchableOpacity
          style={[styles.playButton, isActive && styles.playButtonActive]}
          onPress={handlePlay}
          testID={`play-${joke.id}`}
        >
          {isActive ? (
            <Pause size={22} color={Colors.white} fill={Colors.white} />
          ) : (
            <Play size={22} color={Colors.white} fill={Colors.white} />
          )}
        </TouchableOpacity>

        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(progressPercent, 100)}%` as `${number}%` },
              ]}
            />
          </View>
          <View style={styles.durationRow}>
            <View style={styles.durationBadge}>
              <Clock size={10} color={Colors.textMuted} />
              <Text style={styles.durationText}>
                {isThisJokePlaying && globalAudioStatus.currentTime > 0
                  ? `${formatDuration(globalAudioStatus.currentTime)} / ${formatDuration(globalAudioStatus.duration || joke.duration)}`
                  : formatDuration(joke.duration)}
              </Text>
            </View>
            {isActive && (
              <View style={styles.liveIndicator}>
                <Volume2 size={12} color={Colors.primary} />
                <Text style={styles.liveText}>{t('jokeCard.playing')}</Text>
              </View>
            )}
            {isThisJokePlaying && globalAudioStatus.isBuffering && !globalAudioStatus.playing && (
              <View style={styles.liveIndicator}>
                <Text style={styles.liveText}>{t('jokeCard.buffering')}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.starRatingSection}>
        <View style={styles.communityRating}>
          <View style={styles.starsDisplay}>
            {[1, 2, 3, 4, 5].map(star => (
              <Star
                key={`avg-${star}`}
                size={13}
                color={star <= Math.round(joke.averageRating) ? '#F5A623' : Colors.cardBorder}
                fill={star <= Math.round(joke.averageRating) ? '#F5A623' : 'transparent'}
              />
            ))}
          </View>
          <Text style={styles.ratingValue}>{joke.averageRating.toFixed(1)}</Text>
          <Text style={styles.ratingCount}>({joke.totalRatings})</Text>
        </View>
        <View style={styles.myRating}>
          <Text style={styles.myRatingLabel}>{t('jokeCard.rate')}</Text>
          {[1, 2, 3, 4, 5].map(star => (
            <TouchableOpacity key={`my-${star}`} onPress={() => handleRate(star)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Star
                size={20}
                color={star <= myRating ? '#F5A623' : Colors.cardBorder}
                fill={star <= myRating ? '#F5A623' : 'transparent'}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.reactionsRow}>
        {REACTION_EMOJIS.map(({ emoji, key }) => {
          const isActive = myReactions.includes(key as ReactionEmoji);
          return (
            <Animated.View key={key} style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                style={[styles.reactionBtn, isActive && styles.reactionBtnActive]}
                onPress={() => handleReaction(key as ReactionEmoji)}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                <Text style={[styles.reactionCount, isActive && styles.reactionCountActive]}>
                  {formatCount(joke.reactions[key as ReactionEmoji])}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerBtn} onPress={handleCardPress}>
          <MessageCircle size={16} color={Colors.textSecondary} />
          <Text style={styles.footerText}>{joke.commentsCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerBtn} onPress={handleShare}>
          <Share2 size={16} color={Colors.textSecondary} />
          <Text style={styles.footerText}>{t('jokeCard.share')}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  cardCompact: {
    padding: 12,
    marginHorizontal: 0,
    marginBottom: 10,
  },
  jokeOfDayBadge: {
    backgroundColor: Colors.secondary + '25',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  jokeOfDayText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.warning,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  userText: {
    marginLeft: 10,
    flex: 1,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  meta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  categoryEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  categoryName: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  title: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 12,
    lineHeight: 22,
  },
  playerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 16,
    padding: 12,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  playButtonActive: {
    backgroundColor: '#1565C0',
  },
  progressContainer: {
    flex: 1,
    marginLeft: 12,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.cardBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  durationText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  starRatingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  communityRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  starsDisplay: {
    flexDirection: 'row',
    gap: 1,
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  ratingCount: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  myRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  myRatingLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    marginRight: 2,
  },
  reactionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    gap: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  reactionBtnActive: {
    backgroundColor: Colors.primary + '12',
    borderColor: Colors.primary + '40',
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  reactionCountActive: {
    color: Colors.primary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginRight: 18,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },

});

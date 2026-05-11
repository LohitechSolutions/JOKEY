import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Play, Pause, Send, Clock, ArrowLeft, Share2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CATEGORIES, REACTION_EMOJIS } from '@/mocks/data';
import { ReactionEmoji } from '@/types';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

export default function JokeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    jokes,
    playingJokeId,
    playJoke,
    pauseAudio,
    globalAudioStatus,
    addReaction,
    getJokeReactions,
    totalReactions,
  } = useApp();
  const [commentText, setCommentText] = useState('');

  const { t } = useLanguage();
  const joke = useMemo(() => jokes.find(j => j.id === id), [jokes, id]);
  const myReactions = joke ? getJokeReactions(joke.id) : [];
  const category = joke ? CATEGORIES.find(c => c.id === joke.category) : null;

  const isThisJokePlaying = playingJokeId === id;
  const isPlaying = isThisJokePlaying && globalAudioStatus.playing;
  const progressPercent = isThisJokePlaying && globalAudioStatus.duration > 0
    ? (globalAudioStatus.currentTime / globalAudioStatus.duration) * 100
    : 0;

  const handlePlay = useCallback(() => {
    if (!joke) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isPlaying) {
      pauseAudio();
    } else {
      playJoke(joke);
    }
  }, [isPlaying, joke, playJoke, pauseAudio]);

  const handleReaction = useCallback((emoji: ReactionEmoji) => {
    if (!joke) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addReaction({ jokeId: joke.id, emoji });
  }, [joke, addReaction]);

  const handleSendComment = useCallback(() => {
    if (!commentText.trim()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCommentText('');
    Alert.alert(t('joke.commentSent'), t('joke.commentSentMsg'));
  }, [commentText, t]);

  const handleShare = useCallback(async () => {
    if (!joke) return;
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
      console.log('[JokeDetail] Share error:', error);
    }
  }, [joke, t]);

  if (!joke) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('joke.title') }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundEmoji}>🤷</Text>
          <Text style={styles.notFoundText}>{t('joke.notFound')}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen
        options={{
          title: joke.title || 'Blague',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <ArrowLeft size={22} color={Colors.text} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.jokeHeader}>
          <TouchableOpacity
            style={styles.userRow}
            onPress={() => router.push(`/user/${joke.userId}`)}
          >
            <Image source={{ uri: joke.user.avatar }} style={styles.avatar} />
            <View style={styles.userInfo}>
              <Text style={styles.displayName}>{joke.user.displayName}</Text>
              <Text style={styles.userMeta}>@{joke.user.username} · {timeAgo(joke.createdAt, t)}</Text>
            </View>
          </TouchableOpacity>

          {category && (
            <View style={[styles.categoryBadge, { backgroundColor: category.color + '18' }]}>
              <Text>{category.emoji} </Text>
              <Text style={[styles.categoryText, { color: category.color }]}>{category.name}</Text>
            </View>
          )}
        </View>

        {joke.title ? <Text style={styles.jokeTitle}>{joke.title}</Text> : null}

        <View style={styles.playerCard}>
          <TouchableOpacity
            style={[styles.bigPlayBtn, isPlaying && styles.bigPlayBtnActive]}
            onPress={handlePlay}
          >
            {isPlaying ? (
              <Pause size={32} color={Colors.white} fill={Colors.white} />
            ) : (
              <Play size={32} color={Colors.white} fill={Colors.white} />
            )}
          </TouchableOpacity>

          <View style={styles.playerInfo}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(progressPercent, 100)}%` }]} />
            </View>
            <View style={styles.playerMeta}>
              <View style={styles.durationBadge}>
                <Clock size={12} color={Colors.textMuted} />
                <Text style={styles.durationText}>
                  {isThisJokePlaying && globalAudioStatus.currentTime > 0
                    ? `${formatDuration(globalAudioStatus.currentTime)} / ${formatDuration(globalAudioStatus.duration || joke.duration)}`
                    : formatDuration(joke.duration)}
                </Text>
              </View>
              {isPlaying && (
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>{t('joke.playing')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Share2 size={18} color={Colors.white} />
          <Text style={styles.shareButtonText}>{t('joke.share')}</Text>
        </TouchableOpacity>

        <View style={styles.reactionsSection}>
          <Text style={styles.sectionLabel}>{t('joke.reactions')}</Text>
          <View style={styles.reactionsGrid}>
            {REACTION_EMOJIS.map(({ emoji, key }) => {
              const isActive = myReactions.includes(key as ReactionEmoji);
              const count = joke.reactions[key as ReactionEmoji];
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.reactionCard, isActive && styles.reactionCardActive]}
                  onPress={() => handleReaction(key as ReactionEmoji)}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  <Text style={[styles.reactionCount, isActive && styles.reactionCountActive]}>
                    {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.totalText}>{totalReactions(joke)} {t('joke.totalReactions')}</Text>
        </View>

        <View style={styles.commentsSection}>
          <Text style={styles.sectionLabel}>{t('joke.comments')} (0)</Text>
          <View style={styles.noComments}>
            <Text style={styles.noCommentsEmoji}>💬</Text>
            <Text style={styles.noCommentsText}>{t('joke.firstComment')}</Text>
          </View>
        </View>
      </ScrollView>

      {joke.allowComments && (
        <View style={styles.commentInput}>
          <TextInput
            style={styles.commentTextInput}
            value={commentText}
            onChangeText={setCommentText}
            placeholder={t('joke.writeComment')}
            placeholderTextColor={Colors.textMuted}
            maxLength={200}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
            onPress={handleSendComment}
            disabled={!commentText.trim()}
          >
            <Send size={18} color={commentText.trim() ? Colors.white : Colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerBtn: {
    padding: 4,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  jokeHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  displayName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  userMeta: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  jokeTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.primary,
    paddingHorizontal: 20,
    marginTop: 14,
    lineHeight: 28,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  bigPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  bigPlayBtnActive: {
    backgroundColor: Colors.primary,
  },
  playerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  playerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600' as const,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  liveText: {
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '600' as const,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  reactionsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 12,
  },
  reactionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reactionCard: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    minWidth: 70,
  },
  reactionCardActive: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary + '40',
  },
  reactionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  reactionCount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
  reactionCountActive: {
    color: Colors.primary,
  },
  totalText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 10,
  },
  commentsSection: {
    paddingHorizontal: 20,
  },
  commentCard: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
  },
  commentBody: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  commentTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  commentText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  commentLikes: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  noComments: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noCommentsEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  noCommentsText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    borderTopWidth: 1.5,
    borderTopColor: Colors.cardBorder,
    gap: 10,
  },
  commentTextInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.white,
    maxHeight: 80,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.surface,
  },
});

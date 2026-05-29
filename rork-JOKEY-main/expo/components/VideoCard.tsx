import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Share,
  Platform,
  Alert,
} from 'react-native';
import { Play, Pause, Share2, Clock, Star, Volume2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Video } from '@/types';
import { CATEGORIES } from '@/mocks/data';
import Colors from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';

interface VideoCardProps {
  video: Video;
  compact?: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
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

export default React.memo(function VideoCard({ video, compact }: VideoCardProps) {
  const { t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const category = CATEGORIES.find(c => c.id === video.category);
  const source = useMemo(() => ({ uri: video.videoUri }), [video.videoUri]);
  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.loop = false;
  });

  const handlePlay = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.log('[VideoCard] Playback error:', error);
      setIsPlaying(false);
    }
  }, [isPlaying, player]);

  const handleShare = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const message = `${t('video.shareMsg')}\n\n"${video.title}" par @${video.user.username}\n\n${t('video.downloadJokey')}`;
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title: video.title, text: message });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(message);
          Alert.alert(t('joke.copied'), t('joke.copiedMsg'));
        }
      } else {
        await Share.share({ message, title: `Jokey - ${video.title}` });
      }
    } catch (error) {
      console.log('[VideoCard] Share error:', error);
    }
  }, [video, t]);

  return (
    <View style={[styles.card, compact && styles.cardCompact]} testID={`video-card-${video.id}`}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image source={{ uri: video.user.avatar }} style={styles.avatar} />
          <View style={styles.userText}>
            <Text style={styles.displayName} numberOfLines={1}>{video.user.displayName}</Text>
            <Text style={styles.meta}>@{video.user.username} · {timeAgo(video.createdAt, t)}</Text>
          </View>
        </View>
        {category && (
          <View style={[styles.categoryBadge, { backgroundColor: category.color + '18' }]}>
            <Text style={styles.categoryEmoji}>{category.emoji}</Text>
            <Text style={[styles.categoryName, { color: category.color }]}>{category.name}</Text>
          </View>
        )}
      </View>

      {video.title ? (
        <Text style={styles.title} numberOfLines={2}>{video.title}</Text>
      ) : null}

      <View style={styles.videoContainer}>
        <VideoView
          style={styles.video}
          player={player}
          allowsFullscreen
          allowsPictureInPicture
          contentFit="cover"
          nativeControls={false}
        />
        <TouchableOpacity style={styles.playOverlay} onPress={handlePlay} testID={`play-video-${video.id}`}>
          {isPlaying ? (
            <Pause size={28} color={Colors.white} fill={Colors.white} />
          ) : (
            <Play size={28} color={Colors.white} fill={Colors.white} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.durationBadge}>
          <Clock size={12} color={Colors.textMuted} />
          <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
        </View>
        {isPlaying && (
          <View style={styles.liveIndicator}>
            <Volume2 size={12} color={Colors.primary} />
            <Text style={styles.liveText}>{t('videoCard.playing')}</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.rating}>
          <Star size={15} color="#F5A623" fill="#F5A623" />
          <Text style={styles.ratingText}>{video.averageRating.toFixed(1)}</Text>
          <Text style={styles.ratingCount}>({video.totalRatings})</Text>
        </View>
        <TouchableOpacity style={styles.footerBtn} onPress={handleShare}>
          <Share2 size={16} color={Colors.textSecondary} />
          <Text style={styles.footerText}>{t('jokeCard.share')}</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  videoContainer: {
    height: 360,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 18,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 62,
    height: 62,
    marginLeft: -31,
    marginTop: -31,
    borderRadius: 31,
    backgroundColor: 'rgba(21,101,192,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  ratingCount: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
});

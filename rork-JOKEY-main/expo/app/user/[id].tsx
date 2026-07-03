import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, UserPlus, UserMinus, Mic, Heart, Users, Award, Flag, Ban } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import JokeCard from '@/components/JokeCard';
import { showReportDialog, showReportSuccess, showBlockConfirm } from '@/lib/moderation-client';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { visibleJokes, jokes, currentUser, isFollowing, toggleFollow, isUserBlocked, blockUser, unblockUser, reportContent } = useApp();
  const { t } = useLanguage();

  const user = useMemo(() => {
    const joke = jokes.find(j => j.userId === id);
    return joke?.user ?? null;
  }, [jokes, id]);
  const userJokes = useMemo(() => visibleJokes.filter(j => j.userId === id), [visibleJokes, id]);
  const following = user ? isFollowing(user.id) : false;
  const blocked = user ? isUserBlocked(user.id) : false;
  const isOwnProfile = currentUser?.id === id;

  const handleToggleFollow = useCallback(() => {
    if (!user) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleFollow({ userId: user.id });
  }, [user, toggleFollow]);

  const handleReport = useCallback(() => {
    if (!user) return;
    showReportDialog(t, async (reason) => {
      await reportContent({ targetType: 'user', targetId: user.id, reason });
      showReportSuccess(t);
    });
  }, [user, t, reportContent]);

  const handleBlock = useCallback(() => {
    if (!user) return;
    if (blocked) {
      void unblockUser(user.id);
      Alert.alert(t('moderation.unblockSuccessTitle'), t('moderation.unblockSuccessMsg'));
      return;
    }
    showBlockConfirm(t, user.username, async () => {
      await blockUser(user.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('moderation.blockSuccessTitle'), t('moderation.blockSuccessMsg'));
      router.back();
    });
  }, [user, blocked, t, blockUser, unblockUser, router]);

  if (!user) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('user.profile') }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundEmoji}>🤷</Text>
          <Text style={styles.notFoundText}>{t('user.notFound')}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: user.displayName,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <ArrowLeft size={22} color={Colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.profileCard}>
        <Image source={{ uri: user.avatar }} style={styles.avatar} />
        <Text style={styles.displayName}>{user.displayName}</Text>
        <Text style={styles.username}>@{user.username}</Text>
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

        <View style={styles.actionsRow}>
          {!isOwnProfile && (
            <>
              <TouchableOpacity
                style={[styles.followBtn, following && styles.followBtnActive]}
                onPress={handleToggleFollow}
              >
                {following ? (
                  <>
                    <UserMinus size={16} color={Colors.primary} />
                    <Text style={styles.followBtnTextActive}>{t('user.following')}</Text>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} color={Colors.white} />
                    <Text style={styles.followBtnText}>{t('user.follow')}</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.reportBtn} onPress={handleReport}>
                <Flag size={16} color={Colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.reportBtn} onPress={handleBlock}>
                <Ban size={16} color={blocked ? Colors.error : Colors.textMuted} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {blocked && !isOwnProfile && (
          <View style={styles.blockedBanner}>
            <Text style={styles.blockedText}>{t('moderation.blockedBanner')}</Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Mic size={14} color={Colors.primary} />
            <Text style={styles.statValue}>{userJokes.length}</Text>
            <Text style={styles.statLabel}>{t('profile.jokes')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Heart size={14} color={Colors.accent} />
            <Text style={styles.statValue}>{user.totalLikes}</Text>
            <Text style={styles.statLabel}>{t('profile.likes')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Users size={14} color={Colors.secondary} />
            <Text style={styles.statValue}>{user.followersCount}</Text>
            <Text style={styles.statLabel}>{t('profile.followers')}</Text>
          </View>
        </View>

        {user.badges.length > 0 && (
          <View style={styles.badgesSection}>
            <View style={styles.badgesHeader}>
              <Award size={14} color={Colors.secondary} />
              <Text style={styles.badgesTitle}>{t('profile.badges')}</Text>
            </View>
            <View style={styles.badgesRow}>
              {user.badges.map(badge => (
                <View key={badge.id} style={styles.badge}>
                  <Text style={styles.badgeIcon}>{badge.icon}</Text>
                  <Text style={styles.badgeName}>{badge.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={styles.jokesSection}>
        <Text style={styles.jokesSectionTitle}>{t('user.jokesCount')} ({userJokes.length})</Text>
        {userJokes.map(joke => (
          <JokeCard key={joke.id} joke={joke} compact />
        ))}
        {userJokes.length === 0 && (
          <View style={styles.noJokes}>
            <Text style={styles.noJokesText}>{t('user.noJokes')}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
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
  profileCard: {
    backgroundColor: Colors.card,
    margin: 16,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.surface,
    borderWidth: 3,
    borderColor: Colors.accent + '50',
    marginBottom: 14,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.white,
  },
  username: {
    fontSize: 15,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    gap: 8,
  },
  followBtnActive: {
    backgroundColor: Colors.accent + '12',
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  followBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  followBtnTextActive: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  reportBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 16,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.cardBorder,
  },
  badgesSection: {
    width: '100%',
    marginTop: 16,
  },
  badgesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  badgesTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.secondary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.secondary + '30',
  },
  badgeIcon: {
    fontSize: 14,
  },
  badgeName: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  jokesSection: {
    paddingHorizontal: 16,
  },
  jokesSectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 14,
  },
  noJokes: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noJokesText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  blockedBanner: {
    backgroundColor: Colors.error + '15',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  blockedText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
    fontWeight: '600' as const,
  },
});

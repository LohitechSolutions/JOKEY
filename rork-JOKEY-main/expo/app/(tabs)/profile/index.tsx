import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Settings, Award, Mic, Heart, Users, ChevronRight, LogOut, Trash2, Camera, LogIn, KeyRound } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import JokeCard from '@/components/JokeCard';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();
  const { currentUser, jokes, logout, deleteAccount, deleteJoke, updateProfile, isUpdatingProfile } = useApp();
  const { t } = useLanguage();

  const myJokes = useMemo(() => {
    return jokes.filter(j => j.userId === currentUser?.id);
  }, [jokes, currentUser]);

  const handleDeleteJoke = useCallback((jokeId: string, audioUri: string) => {
    Alert.alert(
      t('profile.deleteJoke'),
      t('profile.deleteJokeConfirm'),
      [
        { text: t('profile.cancel'), style: 'cancel' },
        {
          text: t('profile.delete'),
          style: 'destructive',
          onPress: () => {
            deleteJoke(jokeId, audioUri);
          },
        },
      ]
    );
  }, [deleteJoke, t]);

  const handlePickImage = useCallback(async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('profile.permissionTitle') || 'Permission requise', t('profile.permissionMessage') || 'Veuillez autoriser l\'accès à la galerie photo.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const selectedUri = result.assets[0].uri;
        console.log('[Profile] New avatar selected:', selectedUri);
        try {
          await updateProfile({ localAvatarUri: selectedUri });
          console.log('[Profile] Avatar updated successfully');
        } catch (updateErr) {
          console.error('[Profile] Failed to update avatar:', updateErr);
          Alert.alert(
            t('profile.uploadError') || 'Erreur',
            t('profile.uploadErrorMessage') || 'Impossible de mettre à jour l\'avatar. Veuillez réessayer.'
          );
        }
      }
    } catch (err) {
      console.error('[Profile] Image picker error:', err);
      Alert.alert(
        t('profile.pickerError') || 'Erreur',
        t('profile.pickerErrorMessage') || 'Une erreur s\'est produite lors de la sélection de l\'image.'
      );
    }
  }, [updateProfile, t]);

  const handleLogout = () => {
    Alert.alert(
      t('profile.logout'),
      t('profile.logoutConfirm'),
      [
        { text: t('profile.cancel'), style: 'cancel' },
        {
          text: t('profile.disconnect'),
          style: 'destructive',
          onPress: () => {
            console.log('[Profile] Logout pressed');
            logout();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('settings.deleteTitle'),
      t('profile.deleteConfirm'),
      [
        { text: t('profile.cancel'), style: 'cancel' },
        {
          text: t('profile.delete'),
          style: 'destructive',
          onPress: () => {
            console.log('[Profile] Delete account pressed');
            deleteAccount();
          },
        },
      ]
    );
  };

  const { authChecked, isLoading } = useApp();

  if (!authChecked || isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{t('profile.loading')}</Text>
        </View>
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingState}>
          <Text style={styles.loadingEmoji}>🎙️</Text>
          <Text style={styles.notLoggedTitle}>{t('profile.notLoggedIn') || 'Non connecté'}</Text>
          <Text style={styles.notLoggedSubtitle}>{t('profile.loginToAccess') || 'Connectez-vous pour accéder à votre profil'}</Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push('/auth')}
          >
            <LogIn size={20} color={Colors.accent} />
            <Text style={styles.loginBtnText}>{t('auth.login') || 'Se connecter'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const avatarUri = currentUser.avatar;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
            <View style={styles.avatarWrapper}>
              <Image source={{ uri: avatarUri }} style={[styles.avatar, isUpdatingProfile && { opacity: 0.5 }]} />
              {isUpdatingProfile ? (
                <View style={styles.avatarLoading}>
                  <ActivityIndicator size="small" color={Colors.white} />
                </View>
              ) : (
                <View style={styles.cameraOverlay}>
                  <Camera size={16} color={Colors.white} />
                </View>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.userInfo}>
            <Text style={styles.displayName}>{currentUser.displayName}</Text>
            <Text style={styles.username}>@{currentUser.username}</Text>
          </View>
        </View>

        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {currentUser.role === 'creator' ? t('profile.roleCreator') : t('profile.roleVisitor')}
          </Text>
        </View>

        {currentUser.bio ? (
          <Text style={styles.bio}>{currentUser.bio}</Text>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Mic size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{currentUser.jokesCount}</Text>
            <Text style={styles.statLabel}>{t('profile.jokes')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Heart size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{currentUser.totalLikes}</Text>
            <Text style={styles.statLabel}>{t('profile.likes')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Users size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{currentUser.followersCount}</Text>
            <Text style={styles.statLabel}>{t('profile.followers')}</Text>
          </View>

        </View>

        {currentUser.badges.length > 0 && (
          <View style={styles.badgesSection}>
            <View style={styles.badgesHeader}>
              <Award size={16} color={Colors.primary} />
              <Text style={styles.badgesTitle}>{t('profile.badges')}</Text>
            </View>
            <View style={styles.badgesRow}>
              {currentUser.badges.map(badge => (
                <View key={badge.id} style={styles.badge}>
                  <Text style={styles.badgeIcon}>{badge.icon}</Text>
                  <Text style={styles.badgeName}>{badge.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={styles.menuSection}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/settings')}>
          <Settings size={20} color={Colors.textSecondary} />
          <Text style={styles.menuText}>{t('profile.settings')}</Text>
          <ChevronRight size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.accountSection}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color={Colors.primary} />
          <Text style={styles.logoutText}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetPasswordBtn} onPress={() => router.push('/change-password')}>
          <KeyRound size={18} color={Colors.warning} />
          <Text style={styles.resetPasswordText}>{t('settings.changePassword')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Trash2 size={18} color={Colors.error} />
          <Text style={styles.deleteText}>{t('profile.deleteAccount')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.jokesSection}>
        <Text style={styles.jokesSectionTitle}>{t('profile.myJokes')}</Text>
        {myJokes.length === 0 ? (
          <View style={styles.emptyJokes}>
            <Text style={styles.emptyEmoji}>🎤</Text>
            <Text style={styles.emptyText}>{t('profile.noJokes')}</Text>
            <Text style={styles.emptySubtext}>{t('profile.noJokesSub')}</Text>
          </View>
        ) : (
          myJokes.map(joke => (
            <View key={joke.id}>
              <JokeCard joke={joke} compact />
              <TouchableOpacity
                style={styles.deleteJokeBtn}
                onPress={() => handleDeleteJoke(joke.id, joke.audioUri)}
              >
                <Trash2 size={14} color={Colors.error} />
                <Text style={styles.deleteJokeText}>{t('profile.deleteJoke')}</Text>
              </TouchableOpacity>
            </View>
          ))
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
    paddingBottom: 120,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  notLoggedTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.primary,
    marginTop: 16,
  },
  notLoggedSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'center' as const,
    paddingHorizontal: 40,
  },
  loginBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 24,
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  profileHeader: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: Colors.primary + '30',
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.surface,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  avatarLoading: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  username: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bio: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
  roleBadge: {
    alignSelf: 'flex-start' as const,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 12,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.cardBorder,
  },
  badgesSection: {
    marginTop: 16,
  },
  badgesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  badgesTitle: {
    fontSize: 15,
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
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  badgeIcon: {
    fontSize: 16,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  menuSection: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    gap: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  accountSection: {
    marginHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: Colors.card,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  resetPasswordBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 14,
    backgroundColor: Colors.card,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.warning + '40',
  },
  resetPasswordText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.warning,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: Colors.card,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.error + '40',
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.error,
  },
  jokesSection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  jokesSectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 14,
  },
  emptyJokes: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  deleteJokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: -4,
    marginBottom: 10,
  },
  deleteJokeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.error,
  },
});

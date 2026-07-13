import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  ImageLoadEventData,
  NativeSyntheticEvent,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Shield, Trash2, ImagePlus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ImageJoke } from '@/types';

export default function AdminScreen() {
  const router = useRouter();
  const {
    currentUser,
    isAuthenticated,
    imageJokes,
    publishImageJoke,
    deleteImageJoke,
    isPublishingImageJoke,
    isDeletingImageJoke,
  } = useApp();
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [previewAspectRatio, setPreviewAspectRatio] = useState<number | null>(null);

  const isAdmin = currentUser?.isAdmin === true;

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('admin.imagePermissionTitle'), t('admin.imagePermissionMsg'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      setSelectedImageUri(asset.uri);
      if (asset.width > 0 && asset.height > 0) {
        setPreviewAspectRatio(asset.width / asset.height);
      } else {
        setPreviewAspectRatio(null);
      }
    }
  }, [t]);

  const handlePreviewLoad = useCallback((event: NativeSyntheticEvent<ImageLoadEventData>) => {
    const { width, height } = event.nativeEvent.source;
    if (width > 0 && height > 0) {
      setPreviewAspectRatio(width / height);
    }
  }, []);

  const handlePublish = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert(t('admin.titleRequired'), t('admin.titleRequiredMsg'));
      return;
    }
    if (!selectedImageUri) {
      Alert.alert(t('admin.imageRequired'), t('admin.imageRequiredMsg'));
      return;
    }

    try {
      await publishImageJoke(title.trim(), selectedImageUri);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('admin.publishedTitle'), t('admin.publishedMsg'));
      setTitle('');
      setSelectedImageUri(null);
      setPreviewAspectRatio(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('admin.publishFailed');
      Alert.alert(t('auth.error'), message);
    }
  }, [title, selectedImageUri, publishImageJoke, t]);

  const confirmDelete = useCallback(
    (joke: ImageJoke) => {
      Alert.alert(t('admin.deleteTitle'), t('admin.deleteMsg', { title: joke.title }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteImageJoke(joke);
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (err: unknown) {
                const message = err instanceof Error ? err.message : t('admin.deleteFailed');
                Alert.alert(t('auth.error'), message);
              }
            })();
          },
        },
      ]);
    },
    [deleteImageJoke, t]
  );

  if (!isAuthenticated) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t('admin.title') }} />
        <Shield size={40} color={Colors.primary} />
        <Text style={styles.centeredTitle}>{t('admin.loginRequired')}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/auth')}>
          <Text style={styles.primaryBtnText}>{t('auth.login')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: t('admin.title') }} />
        <Shield size={40} color={Colors.error} />
        <Text style={styles.centeredTitle}>{t('admin.accessDenied')}</Text>
        <Text style={styles.centeredSubtitle}>{t('admin.accessDeniedMsg')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: t('admin.panelTitle'),
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <ArrowLeft size={22} color={Colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.headerSection}>
        <View style={styles.adminIcon}>
          <Shield size={32} color={Colors.white} />
        </View>
        <Text style={styles.headerTitle}>{t('admin.imageJokesTitle')}</Text>
        <Text style={styles.headerSubtitle}>{t('admin.imageJokesDesc')}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.publishNew')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('admin.imageJokeTitlePlaceholder')}
          placeholderTextColor={Colors.textMuted}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
        />

        <TouchableOpacity style={styles.pickImageBtn} onPress={handlePickImage}>
          <ImagePlus size={20} color={Colors.primary} />
          <Text style={styles.pickImageText}>
            {selectedImageUri ? t('admin.changeImage') : t('admin.pickImage')}
          </Text>
        </TouchableOpacity>

        {selectedImageUri ? (
          <Image
            source={{ uri: selectedImageUri }}
            style={[
              styles.preview,
              previewAspectRatio != null ? { aspectRatio: previewAspectRatio } : styles.previewPlaceholder,
            ]}
            resizeMode="contain"
            onLoad={handlePreviewLoad}
          />
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, isPublishingImageJoke && styles.disabledBtn]}
          onPress={handlePublish}
          disabled={isPublishingImageJoke}
        >
          {isPublishingImageJoke ? (
            <ActivityIndicator color={Colors.accent} />
          ) : (
            <Text style={styles.primaryBtnText}>{t('admin.publish')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('admin.publishedList')}</Text>
        {imageJokes.length === 0 ? (
          <Text style={styles.emptyText}>{t('admin.noImageJokes')}</Text>
        ) : (
          imageJokes.map((joke) => (
            <View key={joke.id} style={styles.listItem}>
              <Image source={{ uri: joke.imageUrl }} style={styles.thumbnail} resizeMode="contain" />
              <View style={styles.listText}>
                <Text style={styles.listTitle} numberOfLines={2}>{joke.title}</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => confirmDelete(joke)}
                disabled={isDeletingImageJoke}
              >
                <Trash2 size={18} color={Colors.error} />
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
    paddingBottom: 60,
  },
  headerBtn: {
    padding: 4,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 20,
  },
  adminIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900' as const,
    color: Colors.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  section: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 14,
  },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 14,
  },
  pickImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary + '60',
    paddingVertical: 14,
    marginBottom: 14,
  },
  pickImageText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  preview: {
    width: '100%',
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: Colors.surfaceLight,
  },
  previewPlaceholder: {
    minHeight: 180,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
  },
  listText: {
    flex: 1,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  deleteBtn: {
    padding: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  centeredTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.white,
    textAlign: 'center',
  },
  centeredSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Mic, Square, RotateCcw, Send, ChevronDown, Loader, Play, Pause, Video as VideoIcon, Camera as CameraIcon, FlipHorizontal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import Colors from '@/constants/colors';
import { CATEGORIES } from '@/mocks/data';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { JokeCategory, Joke, Video } from '@/types';
import { createJokeInDB, createVideoInDB, uploadAudioToSupabase, uploadVideoToSupabase } from '@/lib/db-client';

const MAX_DURATION = 180;
const MAX_VIDEO_DURATION = 60;

// High compatibility preset for Android/iOS: Mono (1 channel) is much safer for various hardware
const SAFE_RECORDING_PRESET = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1, 
  bitRate: 128000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: 'aac ', // IOSOutputFormat.MPEG4AAC
    audioQuality: 0x7f, // AudioQuality.MAX
  },
} as any;

export default function RecordScreen() {
  const { addJoke, addVideo, currentUser, incrementCreateCount } = useApp();
  const { t } = useLanguage();
  const [recordingMode, setRecordingMode] = useState<'audio' | 'video'>('audio');
  const [hasRecording, setHasRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasVideoRecording, setHasVideoRecording] = useState(false);
  const [recordedVideoUri, setRecordedVideoUri] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<JokeCategory | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [language] = useState('FR');
  const [level, setLevel] = useState<'all' | 'adult'>('all');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraMicrophonePermission, requestCameraMicrophonePermission] = useMicrophonePermissions();

  const audioRecorder = useAudioRecorder(SAFE_RECORDING_PRESET);
  const recorderState = useAudioRecorderState(audioRecorder, 500);

  const previewSource = useMemo(() => recordedUri ? { uri: recordedUri } : null, [recordedUri]);
  const previewPlayer = useAudioPlayer(previewSource);
  const previewStatus = useAudioPlayerStatus(previewPlayer);
  const videoPreviewSource = useMemo(() => recordedVideoUri ? { uri: recordedVideoUri } : null, [recordedVideoUri]);
  const videoPreviewPlayer = useVideoPlayer(videoPreviewSource, (player) => {
    player.loop = true;
  });

  // Monitor preview player errors
  useEffect(() => {
    if (previewStatus.error) {
      console.error('[Record] Preview player error:', previewStatus.error);
      Alert.alert(t('record.playbackError'), `${t('record.errorMsg')}: ${previewStatus.error}`);
    }
  }, [previewStatus.error, t]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void (async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        console.log('[Record] Permission status:', status);
        setPermissionGranted(status.granted);
        if (status.granted) {
          await setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: true,
          });
        }
      } catch (err) {
        console.log('[Record] Permission error:', err);
        setPermissionGranted(Platform.OS === 'web');
      }
    })();
  }, []);

  const isRecording = recorderState.isRecording;
  const currentDuration = Math.floor(recorderState.durationMillis / 1000);

  const stopRecording = useCallback(async () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await audioRecorder.stop();
      
      // On Android, ensure audio mode is set properly for playback before loading.
      // Use 'doNotMix' to force the system to give us exclusive audio focus and full volume.
      if (Platform.OS === 'android') {
        setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          shouldRouteThroughEarpiece: false,
          interruptionMode: 'doNotMix',
        }).catch(err => console.log('[Audio] Android audio mode setup error:', err));
      } else {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          shouldRouteThroughEarpiece: false,
          interruptionMode: 'mixWithOthers',
        });
      }
      
      const uri = audioRecorder.uri;
      console.log('[Record] Recording stopped, uri:', uri);
      
      // Validate the recorded file exists and has content (Android specific validation)
      if (Platform.OS === 'android' && uri) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(uri);
          console.log('[Record] Android - Recording file info:', { 
            exists: fileInfo.exists, 
            size: fileInfo.size,
            isDirectory: fileInfo.isDirectory 
          });
          if (!fileInfo.exists || (fileInfo.size && fileInfo.size < 1000)) {
            console.warn('[Record] Android - Recording file is empty or missing');
            Alert.alert(t('record.error'), 'Recording file is empty. Please try again.');
            setHasRecording(false);
            return;
          }
        } catch (err) {
          console.log('[Record] Error checking file info:', err);
        }
      }
      
      setRecordedUri(uri);
      setHasRecording(true);
      setRecordingDuration(Math.floor(recorderState.durationMillis / 1000));
    } catch (error) {
      console.error('[Record] Stop error:', error);
      setHasRecording(false);
    }
  }, [audioRecorder, recorderState.durationMillis, t]);

  const stopRecordingRef = useRef(stopRecording);
  stopRecordingRef.current = stopRecording;

  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(currentDuration);
    }
  }, [isRecording, currentDuration]);

  useEffect(() => {
    if (!isVideoRecording) return;

    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setVideoDuration(elapsed);
      if (elapsed >= MAX_VIDEO_DURATION) {
        cameraRef.current?.stopRecording();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isVideoRecording]);

  useEffect(() => {
    if (isRecording && currentDuration >= MAX_DURATION) {
      console.log('[Record] Max duration reached, stopping');
      void stopRecordingRef.current();
    }
  }, [isRecording, currentDuration]);

  const startRecording = useCallback(async () => {
    try {
      // Always ensure permissions are granted
      if (!permissionGranted) {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          Alert.alert(t('record.error'), 'Microphone permission is required to record.');
          return;
        }
        setPermissionGranted(true);
      }

      // Always re-enable recording mode before each recording session.
      // stopRecording sets allowsRecording back to false, so this MUST
      // be called every time — not just on first permission grant.
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setHasRecording(false);
      setRecordedUri(null);
      setRecordingDuration(0);
      progressAnim.setValue(0);

      console.log('[Record] Preparing to record with safe mono preset...');
      await audioRecorder.prepareToRecordAsync(SAFE_RECORDING_PRESET);
      audioRecorder.record();
      console.log('[Record] Recording started');
    } catch (error) {
      console.error('[Record] Failed to start:', error);
      Alert.alert(t('record.error'), t('record.errorMsg'));
    }
  }, [progressAnim, t, permissionGranted, audioRecorder]);

  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const resetRecording = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHasRecording(false);
    setRecordedUri(null);
    setRecordingDuration(0);
    setTitle('');
    setSelectedCategory(null);
    progressAnim.setValue(0);
  }, [progressAnim]);

  const resetVideoRecording = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (videoPreviewPlayer.playing) {
      videoPreviewPlayer.pause();
    }
    setHasVideoRecording(false);
    setRecordedVideoUri(null);
    setVideoDuration(0);
    setTitle('');
    setSelectedCategory(null);
  }, [videoPreviewPlayer]);

  const startVideoRecording = useCallback(async () => {
    try {
      if (!cameraPermission?.granted) {
        const status = await requestCameraPermission();
        if (!status.granted) {
          Alert.alert(t('record.error'), t('record.cameraPermissionRequired'));
          return;
        }
      }

      if (!cameraMicrophonePermission?.granted) {
        const status = await requestCameraMicrophonePermission();
        if (!status.granted) {
          Alert.alert(t('record.error'), t('record.microphonePermissionRequired'));
          return;
        }
      }

      if (!cameraRef.current) {
        Alert.alert(t('record.error'), t('record.cameraUnavailable'));
        return;
      }

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setHasVideoRecording(false);
      setRecordedVideoUri(null);
      setVideoDuration(0);
      setIsVideoRecording(true);

      const startedAt = Date.now();
      const result = await cameraRef.current.recordAsync({ maxDuration: MAX_VIDEO_DURATION });
      if (result?.uri) {
        const duration = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
        if (Platform.OS === 'android') {
          try {
            const fileInfo = await FileSystem.getInfoAsync(result.uri);
            if (!fileInfo.exists || (fileInfo.size && fileInfo.size < 1000)) {
              Alert.alert(t('record.error'), t('record.videoEmpty'));
              setHasVideoRecording(false);
              return;
            }
          } catch (err) {
            console.log('[Record] Error checking video file info:', err);
          }
        }
        setRecordedVideoUri(result.uri);
        setHasVideoRecording(true);
        setVideoDuration(Math.min(duration, MAX_VIDEO_DURATION));
      }
    } catch (error) {
      console.error('[Record] Failed to record video:', error);
      Alert.alert(t('record.error'), t('record.videoErrorMsg'));
    } finally {
      setIsVideoRecording(false);
    }
  }, [
    cameraPermission?.granted,
    cameraMicrophonePermission?.granted,
    requestCameraPermission,
    requestCameraMicrophonePermission,
    t,
  ]);

  const stopVideoRecording = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cameraRef.current?.stopRecording();
  }, []);

  const toggleCameraFacing = useCallback(() => {
    setCameraFacing(prev => (prev === 'front' ? 'back' : 'front'));
  }, []);

  const [isUploading, setIsUploading] = useState(false);

  const publishJoke = useCallback(async () => {
    if (!selectedCategory) {
      Alert.alert(t('record.categoryRequired'), t('record.categoryRequiredMsg'));
      return;
    }
    if (recordingDuration < 3) {
      Alert.alert(t('record.tooShort'), t('record.tooShortMsg'));
      return;
    }
    if (!currentUser) return;
    if (!recordedUri) {
      Alert.alert(t('record.error'), 'No audio recorded.');
      return;
    }

    setIsUploading(true);

    try {
      const jokeId = `j_${Date.now()}`;
      console.log('[Record] Uploading audio for joke:', jokeId);

      let audioUrl = recordedUri;
      try {
        audioUrl = await uploadAudioToSupabase(recordedUri, jokeId);
        console.log('[Record] Audio uploaded, public URL:', audioUrl);
      } catch (uploadErr) {
        console.warn('[Record] Audio upload failed, using local URI:', uploadErr);
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const newJoke: Joke = {
        id: jokeId,
        userId: currentUser.id,
        user: currentUser,
        title: title || t('record.untitled'),
        audioUri: audioUrl,
        duration: recordingDuration,
        category: selectedCategory,
        tags: [],
        language,
        level,
        allowComments: true,
        reactions: { '😂': 0, '🤣': 0, '😭': 0, '💀': 0, '👏': 0, '❤️': 0 },
        commentsCount: 0,
        createdAt: new Date().toISOString(),
        isTrending: false,
        isJokeOfDay: false,
        averageRating: 0,
        totalRatings: 0,
      };

      addJoke(newJoke);
      incrementCreateCount();

      createJokeInDB({
        id: newJoke.id,
        userId: currentUser.id,
        title: newJoke.title,
        audioUri: audioUrl,
        duration: newJoke.duration,
        category: newJoke.category,
        tags: newJoke.tags,
        language: newJoke.language,
        level: newJoke.level,
        allowComments: newJoke.allowComments,
      }, currentUser).then(() => {
        console.log('[Record] Joke saved to Supabase with audio URL');
      }).catch((err) => {
        console.warn('[Record] Failed to save to Supabase (local only):', err);
      });

      Alert.alert(t('record.published'), t('record.publishedMsg'));
      resetRecording();
    } catch (err) {
      console.error('[Record] Publish error:', err);
      Alert.alert(t('record.error'), 'Failed to publish joke. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [selectedCategory, recordingDuration, title, language, level, currentUser, addJoke, resetRecording, t, recordedUri, incrementCreateCount]);

  const publishVideo = useCallback(async () => {
    if (!selectedCategory) {
      Alert.alert(t('record.categoryRequired'), t('record.categoryRequiredMsg'));
      return;
    }
    if (videoDuration < 3) {
      Alert.alert(t('record.tooShort'), t('record.videoTooShortMsg'));
      return;
    }
    if (!currentUser) return;
    if (!recordedVideoUri) {
      Alert.alert(t('record.error'), t('record.noVideoRecorded'));
      return;
    }

    setIsUploading(true);

    try {
      const videoId = `v_${Date.now()}`;
      console.log('[Record] Uploading video:', videoId);

      let videoUrl = recordedVideoUri;
      try {
        videoUrl = await uploadVideoToSupabase(recordedVideoUri, videoId);
        console.log('[Record] Video uploaded, public URL:', videoUrl);
      } catch (uploadErr) {
        console.warn('[Record] Video upload failed, using local URI:', uploadErr);
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const newVideo: Video = {
        id: videoId,
        userId: currentUser.id,
        user: currentUser,
        title: title || t('record.videoUntitled'),
        videoUri: videoUrl,
        duration: videoDuration,
        category: selectedCategory,
        tags: [],
        language,
        level,
        allowComments: true,
        reactions: { '😂': 0, '🤣': 0, '😭': 0, '💀': 0, '👏': 0, '❤️': 0 },
        commentsCount: 0,
        createdAt: new Date().toISOString(),
        isTrending: false,
        averageRating: 0,
        totalRatings: 0,
      };

      addVideo(newVideo);
      incrementCreateCount();

      createVideoInDB({
        id: newVideo.id,
        userId: currentUser.id,
        title: newVideo.title,
        videoUri: videoUrl,
        thumbnailUri: newVideo.thumbnailUri,
        duration: newVideo.duration,
        category: newVideo.category,
        tags: newVideo.tags,
        language: newVideo.language,
        level: newVideo.level,
        allowComments: newVideo.allowComments,
      }, currentUser).then(() => {
        console.log('[Record] Video saved to Supabase');
      }).catch((err) => {
        console.warn('[Record] Failed to save video to Supabase (local only):', err);
      });

      Alert.alert(t('record.videoPublished'), t('record.videoPublishedMsg'));
      resetVideoRecording();
    } catch (err) {
      console.error('[Record] Publish video error:', err);
      Alert.alert(t('record.error'), t('record.videoPublishError'));
    } finally {
      setIsUploading(false);
    }
  }, [selectedCategory, videoDuration, currentUser, recordedVideoUri, title, language, level, t, addVideo, incrementCreateCount, resetVideoRecording]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const displayDuration = isRecording ? currentDuration : recordingDuration;
  const progressPercent = (displayDuration / MAX_DURATION) * 100;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, recordingMode === 'audio' && styles.modeBtnActive]}
          onPress={() => setRecordingMode('audio')}
        >
          <Mic size={18} color={recordingMode === 'audio' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.modeText, recordingMode === 'audio' && styles.modeTextActive]}>
            {t('record.audioMode')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, recordingMode === 'video' && styles.modeBtnActive]}
          onPress={() => setRecordingMode('video')}
        >
          <VideoIcon size={18} color={recordingMode === 'video' ? Colors.accent : Colors.textSecondary} />
          <Text style={[styles.modeText, recordingMode === 'video' && styles.modeTextActive]}>
            {t('record.videoMode')}
          </Text>
        </TouchableOpacity>
      </View>

      {recordingMode === 'audio' ? (
        <>
      <View style={styles.recordSection}>
        <View style={styles.timerContainer}>
          <Text style={[styles.timer, isRecording && styles.timerActive]}>
            {formatTime(displayDuration)}
          </Text>
          <Text style={styles.maxDuration}>/ {formatTime(MAX_DURATION)}</Text>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>

        {isRecording && (
          <View style={styles.waveBars}>
            {Array.from({ length: 20 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  { height: 8 + Math.random() * 32, opacity: 0.4 + Math.random() * 0.6 },
                ]}
              />
            ))}
          </View>
        )}

        <View style={styles.buttonRow}>
          {hasRecording && !isRecording && (
            <TouchableOpacity 
              style={[styles.secondaryBtn, { backgroundColor: Colors.primary + '20', borderColor: Colors.primary }]} 
              onPress={async () => {
                if (previewStatus.playing) {
                  previewPlayer.pause();
                } else {
                  try {
                    // Ensure audio mode is set for playback on Android
                    if (Platform.OS === 'android') {
                      await setAudioModeAsync({
                        playsInSilentMode: true,
                        allowsRecording: false,
                        shouldRouteThroughEarpiece: false,
                        interruptionMode: 'mixWithOthers',
                      });
                    }
                    previewPlayer.volume = 1.0;
                    try { previewPlayer.seekTo(0); } catch (e) { console.log('[Record] seekTo error:', e); }
                    previewPlayer.play();
                  } catch (err) {
                    console.error('[Record] Preview play error:', err);
                    Alert.alert(t('record.error'), t('record.playbackError'));
                  }
                }
              }}
            >
              {previewStatus.playing ? (
                <Pause size={24} color={Colors.primary} fill={Colors.primary} />
              ) : (
                <Play size={24} color={Colors.primary} fill={Colors.primary} />
              )}
            </TouchableOpacity>
          )}

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[
                styles.recordButton,
                isRecording && styles.recordButtonActive,
                hasRecording && !isRecording && styles.recordButtonDone,
              ]}
              onPress={isRecording ? stopRecording : startRecording}
              testID="record-button"
            >
              {isRecording ? (
                <Square size={28} color={Colors.white} fill={Colors.white} />
              ) : (
                <Mic size={32} color="#1565C0" />
              )}
            </TouchableOpacity>
          </Animated.View>

          {hasRecording && !isRecording && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={resetRecording}>
              <RotateCcw size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.hint}>
          {isRecording
            ? t('record.tapToStop')
            : hasRecording
            ? t('record.recordingDone')
            : t('record.tapToRecord')}
        </Text>
      </View>

      {hasRecording && !isRecording && (
        <View style={styles.publishSection}>
          <Text style={styles.sectionTitle}>{t('record.publishTitle')}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('record.titleOptional')}</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder={t('record.titlePlaceholder')}
              placeholderTextColor={Colors.textMuted}
              maxLength={60}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('record.category')}</Text>
            <TouchableOpacity
              style={styles.pickerBtn}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            >
              <Text style={selectedCategory ? styles.pickerText : styles.pickerPlaceholder}>
                {selectedCategory
                  ? CATEGORIES.find(c => c.id === selectedCategory)?.emoji + ' ' +
                    CATEGORIES.find(c => c.id === selectedCategory)?.name
                  : t('record.selectCategory')}
              </Text>
              <ChevronDown size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            {showCategoryPicker && (
              <View style={styles.categoryGrid}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      selectedCategory === cat.id && { backgroundColor: cat.color + '20', borderColor: cat.color },
                    ]}
                    onPress={() => {
                      setSelectedCategory(cat.id);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                    <Text style={[
                      styles.chipText,
                      selectedCategory === cat.id && { color: cat.color },
                    ]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('record.level')}</Text>
            <View style={styles.levelRow}>
              <TouchableOpacity
                style={[styles.levelBtn, level === 'all' && styles.levelBtnActive]}
                onPress={() => setLevel('all')}
              >
                <Text style={[styles.levelText, level === 'all' && styles.levelTextActive]}>
                  {t('record.allPublic')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.levelBtn, level === 'adult' && styles.levelBtnActive]}
                onPress={() => setLevel('adult')}
              >
                <Text style={[styles.levelText, level === 'adult' && styles.levelTextActive]}>
                  {t('record.adult')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.publishBtn, isUploading && styles.publishBtnDisabled]}
            onPress={publishJoke}
            disabled={isUploading}
            testID="publish-button"
          >
            {isUploading ? (
              <Loader size={20} color={Colors.accent} />
            ) : (
              <Send size={20} color={Colors.accent} />
            )}
            <Text style={styles.publishBtnText}>
              {isUploading ? t('record.publishing') : t('record.publish')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
        </>
      ) : (
        <>
          <View style={styles.videoSection}>
            <View style={styles.timerContainer}>
              <Text style={[styles.timer, isVideoRecording && styles.timerActive]}>
                {formatTime(videoDuration)}
              </Text>
              <Text style={styles.maxDuration}>/ {formatTime(MAX_VIDEO_DURATION)}</Text>
            </View>

            <View style={styles.cameraContainer}>
              {hasVideoRecording && recordedVideoUri ? (
                <VideoView
                  style={styles.cameraPreview}
                  player={videoPreviewPlayer}
                  allowsFullscreen
                  contentFit="cover"
                  nativeControls
                />
              ) : (
                <CameraView
                  ref={cameraRef}
                  style={styles.cameraPreview}
                  facing={cameraFacing}
                  mode="video"
                  mute={false}
                  active={recordingMode === 'video'}
                />
              )}
            </View>

            <View style={styles.buttonRow}>
              {!hasVideoRecording && (
                <TouchableOpacity style={styles.secondaryBtn} onPress={toggleCameraFacing} disabled={isVideoRecording}>
                  <FlipHorizontal size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.recordButton,
                  isVideoRecording && styles.recordButtonActive,
                  hasVideoRecording && !isVideoRecording && styles.recordButtonDone,
                ]}
                onPress={isVideoRecording ? stopVideoRecording : startVideoRecording}
                testID="video-record-button"
              >
                {isVideoRecording ? (
                  <Square size={28} color={Colors.white} fill={Colors.white} />
                ) : (
                  <CameraIcon size={32} color="#1565C0" />
                )}
              </TouchableOpacity>

              {hasVideoRecording && !isVideoRecording && (
                <TouchableOpacity style={styles.secondaryBtn} onPress={resetVideoRecording}>
                  <RotateCcw size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.hint}>
              {isVideoRecording
                ? t('record.tapToStopVideo')
                : hasVideoRecording
                ? t('record.videoDone')
                : t('record.tapToRecordVideo')}
            </Text>
          </View>

          {hasVideoRecording && !isVideoRecording && (
            <View style={styles.publishSection}>
              <Text style={styles.sectionTitle}>{t('record.publishVideoTitle')}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('record.titleOptional')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t('record.videoTitlePlaceholder')}
                  placeholderTextColor={Colors.textMuted}
                  maxLength={60}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('record.category')}</Text>
                <TouchableOpacity
                  style={styles.pickerBtn}
                  onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                >
                  <Text style={selectedCategory ? styles.pickerText : styles.pickerPlaceholder}>
                    {selectedCategory
                      ? CATEGORIES.find(c => c.id === selectedCategory)?.emoji + ' ' +
                        CATEGORIES.find(c => c.id === selectedCategory)?.name
                      : t('record.selectCategory')}
                  </Text>
                  <ChevronDown size={18} color={Colors.textMuted} />
                </TouchableOpacity>
                {showCategoryPicker && (
                  <View style={styles.categoryGrid}>
                    {CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryChip,
                          selectedCategory === cat.id && { backgroundColor: cat.color + '20', borderColor: cat.color },
                        ]}
                        onPress={() => {
                          setSelectedCategory(cat.id);
                          setShowCategoryPicker(false);
                        }}
                      >
                        <Text style={styles.chipEmoji}>{cat.emoji}</Text>
                        <Text style={[
                          styles.chipText,
                          selectedCategory === cat.id && { color: cat.color },
                        ]}>{cat.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('record.level')}</Text>
                <View style={styles.levelRow}>
                  <TouchableOpacity
                    style={[styles.levelBtn, level === 'all' && styles.levelBtnActive]}
                    onPress={() => setLevel('all')}
                  >
                    <Text style={[styles.levelText, level === 'all' && styles.levelTextActive]}>
                      {t('record.allPublic')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.levelBtn, level === 'adult' && styles.levelBtnActive]}
                    onPress={() => setLevel('adult')}
                  >
                    <Text style={[styles.levelText, level === 'adult' && styles.levelTextActive]}>
                      {t('record.adult')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.publishBtn, isUploading && styles.publishBtnDisabled]}
                onPress={publishVideo}
                disabled={isUploading}
                testID="publish-video-button"
              >
                {isUploading ? (
                  <Loader size={20} color={Colors.accent} />
                ) : (
                  <Send size={20} color={Colors.accent} />
                )}
                <Text style={styles.publishBtnText}>
                  {isUploading ? t('record.publishing') : t('record.publishVideo')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
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
  modeToggle: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 6,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
  modeTextActive: {
    color: Colors.accent,
  },
  recordSection: {
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  videoSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  cameraContainer: {
    width: '100%',
    height: 430,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    marginBottom: 24,
  },
  cameraPreview: {
    width: '100%',
    height: '100%',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  timer: {
    fontSize: 48,
    fontWeight: '300' as const,
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },
  timerActive: {
    color: Colors.accent,
    fontWeight: '400' as const,
  },
  maxDuration: {
    fontSize: 16,
    color: Colors.textMuted,
    marginLeft: 8,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.cardBorder,
    borderRadius: 2,
    marginBottom: 30,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  waveBars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    gap: 3,
    marginBottom: 30,
  },
  waveBar: {
    width: 4,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  recordButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  recordButtonActive: {
    backgroundColor: '#1565C0',
  },
  recordButtonDone: {
    backgroundColor: Colors.success,
  },
  secondaryBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  hint: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  publishSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.primary,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  pickerText: {
    fontSize: 15,
    color: Colors.white,
    fontWeight: '500' as const,
  },
  pickerPlaceholder: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    gap: 4,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  levelRow: {
    flexDirection: 'row',
    gap: 10,
  },
  levelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.card,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  levelBtnActive: {
    backgroundColor: Colors.primary + '12',
    borderColor: Colors.primary,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  levelTextActive: {
    color: Colors.primary,
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
    marginTop: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  publishBtnText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.accent,
  },
  publishBtnDisabled: {
    opacity: 0.6,
  },
});

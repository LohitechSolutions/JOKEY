import { supabase, isSupabaseConfigured } from './supabase';
import { User, Joke, Video, ReactionEmoji, Comment } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const LOCAL_COMMENTS_KEY = 'joky_local_comments';




export function isClientDBAvailable(): boolean {
  return isSupabaseConfigured;
}

export async function ensureDBReady(): Promise<boolean> {
  if (!isClientDBAvailable()) {
    console.log('[DB] Supabase not configured - running in local-only mode');
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const { error } = await supabase.from('users').select('id').limit(1).abortSignal(controller.signal);
    clearTimeout(timeoutId);

    if (error) {
      console.warn('[DB] Connectivity test failed:', error.message);
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.warn('[DB] Tables not created yet. Run the SQL setup in Supabase dashboard.');
      }
      return false;
    }
    console.log('[DB] Supabase connectivity OK');
    return true;
  } catch (err: any) {
    console.error('[DB] Supabase connectivity error:', err?.message);
    return false;
  }
}

type UserCounterField = 'jokes_count' | 'followers_count' | 'following_count';

async function adjustUserCounter(
  userId: string,
  field: UserCounterField,
  delta: number
): Promise<void> {
  if (!delta) return;

  const { data, error } = await supabase.from('users').select(field).eq('id', userId).single();
  if (error || !data) {
    console.warn('[DB] adjustUserCounter read failed:', field, error?.message);
    return;
  }

  const current = (data as Record<UserCounterField, number>)[field] || 0;
  const next = Math.max(0, current + delta);
  const { error: updateError } = await supabase.from('users').update({ [field]: next }).eq('id', userId);
  if (updateError) {
    console.warn('[DB] adjustUserCounter update failed:', field, updateError.message);
  }
}

export async function refreshUserProfileStats(
  userId: string
): Promise<Pick<User, 'jokesCount' | 'followersCount' | 'followingCount'>> {
  const [jokesResult, followersResult, followingResult] = await Promise.all([
    supabase.from('jokes').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);

  const jokesCount = jokesResult.count ?? 0;
  const followersCount = followersResult.count ?? 0;
  const followingCount = followingResult.count ?? 0;

  const { error } = await supabase
    .from('users')
    .update({ jokes_count: jokesCount, followers_count: followersCount, following_count: followingCount })
    .eq('id', userId);

  if (error) {
    console.warn('[DB] refreshUserProfileStats update failed:', error.message);
  }

  return { jokesCount, followersCount, followingCount };
}

export async function fetchFollowingIdsFromDB(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (error) {
    console.warn('[DB] fetchFollowingIds error:', error.message);
    return [];
  }

  return (data ?? []).map((row) => row.following_id).filter(Boolean);
}

export async function fetchTotalUserCount(): Promise<number> {
  const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
  if (error) {
    console.warn('[DB] fetchTotalUserCount error:', error.message);
    return 0;
  }
  return count ?? 0;
}

function mapDbUserToUser(row: any): User {
  return {
    id: row.id,
    username: row.username || '',
    displayName: row.display_name || row.username || '',
    avatar: row.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.username || 'U')}&background=1565C0&color=fff&size=150`,
    bio: row.bio || '',
    language: row.language || 'FR',
    role: row.role || 'creator',
    jokesCount: row.jokes_count || 0,
    totalLikes: row.total_likes || 0,
    followersCount: row.followers_count || 0,
    followingCount: row.following_count || 0,
    badges: row.badges || [],
    createdAt: row.created_at || '',
    isFollowing: false,
    isAdmin: row.is_admin === true,
  };
}

function mapDbCommentToComment(row: any, userMap: Map<string, User>): Comment {
  const userId = row.user_id || '';
  return {
    id: row.id,
    userId,
    user: userMap.get(userId) || {
      id: userId,
      username: 'unknown',
      displayName: 'Unknown',
      avatar: 'https://ui-avatars.com/api/?name=U&background=1565C0&color=fff&size=150',
      bio: '',
      language: 'FR',
      role: 'creator' as const,
      jokesCount: 0,
      totalLikes: 0,
      followersCount: 0,
      followingCount: 0,
      isFollowing: false,
      badges: [],
      createdAt: '',
    },
    jokeId: row.joke_id || '',
    text: row.text || '',
    createdAt: row.created_at || new Date().toISOString(),
    likes: row.likes || 0,
  };
}

async function readLocalCommentsStore(): Promise<Record<string, Comment[]>> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_COMMENTS_KEY);
    return raw ? JSON.parse(raw) as Record<string, Comment[]> : {};
  } catch {
    return {};
  }
}

async function writeLocalCommentsStore(store: Record<string, Comment[]>): Promise<void> {
  await AsyncStorage.setItem(LOCAL_COMMENTS_KEY, JSON.stringify(store));
}

export async function fetchCommentsFromDB(jokeId: string): Promise<Comment[]> {
  if (!isClientDBAvailable()) {
    const store = await readLocalCommentsStore();
    return store[jokeId] ?? [];
  }

  try {
    const { data: rows, error } = await supabase
      .from('comments')
      .select('*')
      .eq('joke_id', jokeId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.warn('[DB] comments table missing — run supabase-comments.sql');
        return [];
      }
      console.warn('[DB] fetchComments error:', error.message);
      return [];
    }

    if (!rows || rows.length === 0) return [];

    const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
    const userMap = new Map<string, User>();

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .in('id', userIds);

      if (!usersError && users) {
        for (const user of users) {
          userMap.set(user.id, mapDbUserToUser(user));
        }
      }
    }

    return rows.map((row) => mapDbCommentToComment(row, userMap));
  } catch (err: any) {
    console.error('[DB] fetchComments exception:', err?.message);
    return [];
  }
}

export async function addCommentToDB(jokeId: string, user: User, text: string): Promise<Comment> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Comment cannot be empty');
  }

  const comment: Comment = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: user.id,
    user,
    jokeId,
    text: trimmed,
    createdAt: new Date().toISOString(),
    likes: 0,
  };

  if (!isClientDBAvailable()) {
    const store = await readLocalCommentsStore();
    const existing = store[jokeId] ?? [];
    store[jokeId] = [comment, ...existing];
    await writeLocalCommentsStore(store);
    return comment;
  }

  await ensureUserRecordExists(user);

  const { error } = await supabase.from('comments').insert({
    id: comment.id,
    joke_id: jokeId,
    user_id: user.id,
    text: trimmed,
    likes: 0,
  });

  if (error) {
    console.error('[DB] addComment error:', error.message);
    throw new Error(error.message);
  }

  const { data: jokeRow } = await supabase.from('jokes').select('comments_count').eq('id', jokeId).single();
  const nextCount = (jokeRow?.comments_count ?? 0) + 1;
  await supabase.from('jokes').update({ comments_count: nextCount }).eq('id', jokeId);

  return comment;
}

function mapDbJokeToJoke(row: any, userMap: Map<string, User>): Joke {
  const userId = row.user_id || '';
  return {
    id: row.id,
    userId,
    user: userMap.get(userId) || {
      id: userId,
      username: 'unknown',
      displayName: 'Unknown',
      avatar: 'https://ui-avatars.com/api/?name=U&background=1565C0&color=fff&size=150',
      bio: '',
      language: 'FR',
      role: 'creator' as const,
      jokesCount: 0,
      totalLikes: 0,
      followersCount: 0,
      followingCount: 0,
      isFollowing: false,
      badges: [],
      createdAt: '',
    },
    title: row.title || '',
    audioUri: row.audio_uri || '',
    duration: row.duration || 0,
    category: row.category || 'courtes',
    tags: row.tags || [],
    language: row.language || 'FR',
    level: row.level || 'all',
    allowComments: row.allow_comments !== false,
    reactions: row.reactions || { '😂': 0, '🤣': 0, '😭': 0, '💀': 0, '👏': 0, '❤️': 0 },
    commentsCount: row.comments_count || 0,
    createdAt: row.created_at || '',
    isTrending: row.is_trending || false,
    isJokeOfDay: row.is_joke_of_day || false,
    averageRating: row.average_rating || 0,
    totalRatings: row.total_ratings || 0,
  };
}

function mapDbVideoToVideo(row: any, userMap: Map<string, User>): Video {
  const userId = row.user_id || '';
  return {
    id: row.id,
    userId,
    user: userMap.get(userId) || {
      id: userId,
      username: 'unknown',
      displayName: 'Unknown',
      avatar: 'https://ui-avatars.com/api/?name=U&background=1565C0&color=fff&size=150',
      bio: '',
      language: 'FR',
      role: 'creator' as const,
      jokesCount: 0,
      totalLikes: 0,
      followersCount: 0,
      followingCount: 0,
      isFollowing: false,
      badges: [],
      createdAt: '',
    },
    title: row.title || '',
    videoUri: row.video_uri || '',
    thumbnailUri: row.thumbnail_uri || undefined,
    duration: row.duration || 0,
    category: row.category || 'courtes',
    tags: row.tags || [],
    language: row.language || 'FR',
    level: row.level || 'all',
    allowComments: row.allow_comments !== false,
    reactions: row.reactions || { '😂': 0, '🤣': 0, '😭': 0, '💀': 0, '👏': 0, '❤️': 0 },
    commentsCount: row.comments_count || 0,
    createdAt: row.created_at || '',
    isTrending: row.is_trending || false,
    averageRating: row.average_rating || 0,
    totalRatings: row.total_ratings || 0,
  };
}

export async function fetchJokesFromDB(): Promise<Joke[]> {
  console.log('[DB] Fetching jokes from Supabase...');
  try {
    const { data: jokes, error } = await supabase
      .from('jokes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[DB] Error fetching jokes:', error.message);
      return [];
    }

    if (!jokes || jokes.length === 0) return [];

    const userIds = Array.from(new Set(jokes.map((j: any) => j.user_id).filter(Boolean)));
    const userMap = new Map<string, User>();

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .in('id', userIds);

      if (!usersError && users) {
        for (const u of users) {
          userMap.set(u.id, mapDbUserToUser(u));
        }
      }
    }

    return jokes.map((j: any) => mapDbJokeToJoke(j, userMap));
  } catch (err: any) {
    console.error('[DB] fetchJokes exception:', err?.message);
    return [];
  }
}

export async function fetchVideosFromDB(): Promise<Video[]> {
  console.log('[DB] Fetching videos from Supabase...');
  try {
    const { data: videos, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.warn('[DB] videos table missing — run supabase-videos.sql');
        return [];
      }
      console.warn('[DB] Error fetching videos:', error.message);
      return [];
    }

    if (!videos || videos.length === 0) return [];

    const userIds = Array.from(new Set(videos.map((v: any) => v.user_id).filter(Boolean)));
    const userMap = new Map<string, User>();

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .in('id', userIds);

      if (!usersError && users) {
        for (const u of users) {
          userMap.set(u.id, mapDbUserToUser(u));
        }
      }
    }

    return videos.map((v: any) => mapDbVideoToVideo(v, userMap));
  } catch (err: any) {
    console.error('[DB] fetchVideos exception:', err?.message);
    return [];
  }
}

export async function fetchUserById(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) return null;
    return mapDbUserToUser(data);
  } catch {
    return null;
  }
}

/**
 * Ensures a user record exists in the 'users' table to avoid foreign key violations.
 */
export async function ensureUserRecordExists(user: User): Promise<void> {
  if (!isClientDBAvailable()) return;

  try {
    // First check if user exists
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (existing && !checkError) {
      return;
    }

    console.log('[DB] Creating missing user record for:', user.id);
    
    // Try to get email from auth if not in user object
    let email = (user as any).email;
    if (!email) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser?.id === user.id) {
        email = authUser.email;
      }
    }

    const { error: insertError } = await supabase.from('users').insert({
      id: user.id,
      username: user.username,
      email: email || '',
      display_name: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      language: user.language,
      role: user.role,
      jokes_count: user.jokesCount,
      total_likes: user.totalLikes,
      followers_count: user.followersCount,
      following_count: user.followingCount,
      badges: user.badges,
    });

    if (insertError) {
      console.warn('[DB] Failed to create user record:', insertError.message);
    } else {
      console.log('[DB] User record created successfully');
    }
  } catch (err: any) {
    console.warn('[DB] Error in ensureUserRecordExists:', err?.message);
  }
}

export async function uploadAudioToSupabase(localUri: string, jokeId: string): Promise<string> {
  console.log('[DB] Uploading audio to Supabase Storage...', localUri);

  try {
    const fileName = `${jokeId}_${Date.now()}.m4a`;
    const filePath = `jokes/${fileName}`;

    // Fix for React Native + Supabase 0-byte file upload bug on BOTH Android and iOS
    // We use fetch() on the local file URI to get an ArrayBuffer directly.
    // This is the fastest and most reliable way in modern Expo/React Native.
    const response = await fetch(localUri);
    if (!response.ok) {
      throw new Error(`Failed to read local file: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    console.log('[DB] Uploading ArrayBuffer of size:', arrayBuffer.byteLength);

    // Use standard audio/mp4 MIME type for .m4a files which is compatible with Android
    const { data, error } = await supabase.storage
      .from('audio')
      .upload(filePath, arrayBuffer, {
        contentType: 'audio/mp4', // Standard MIME type for .m4a files
        upsert: true,
        duplex: 'half',
      });

    if (error) {
      console.error('[DB] Audio upload error:', error.message, JSON.stringify(error));
      throw new Error(error.message);
    }
    console.log('[DB] Audio uploaded successfully:', data?.path);

    const { data: publicUrlData } = supabase.storage
      .from('audio')
      .getPublicUrl(filePath);

    console.log('[DB] Audio public URL:', publicUrlData.publicUrl);
    
    // Verify the URL is properly formatted and accessible
    if (!publicUrlData.publicUrl) {
      throw new Error('Failed to generate public URL for audio');
    }
    
    return publicUrlData.publicUrl;
  } catch (err: any) {
    console.error('[DB] uploadAudio exception:', err?.message);
    throw err;
  }
}

export async function uploadVideoToSupabase(localUri: string, videoId: string): Promise<string> {
  console.log('[DB] Uploading video to Supabase Storage...', localUri);

  try {
    const uriLower = localUri.toLowerCase();
    const ext = uriLower.includes('.mov') ? 'mov' : 'mp4';
    const contentType = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
    const fileName = `${videoId}_${Date.now()}.${ext}`;
    const filePath = `videos/${fileName}`;

    const response = await fetch(localUri);
    if (!response.ok) {
      throw new Error(`Failed to read local video: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error('Video file is empty');
    }

    const { data, error } = await supabase.storage
      .from('videos')
      .upload(filePath, arrayBuffer, {
        contentType,
        upsert: true,
        duplex: 'half',
      });

    if (error) {
      console.error('[DB] Video upload error:', error.message, JSON.stringify(error));
      throw new Error(error.message);
    }
    console.log('[DB] Video uploaded successfully:', data?.path);

    const { data: publicUrlData } = supabase.storage
      .from('videos')
      .getPublicUrl(filePath);

    if (!publicUrlData.publicUrl) {
      throw new Error('Failed to generate public URL for video');
    }

    return publicUrlData.publicUrl;
  } catch (err: any) {
    console.error('[DB] uploadVideo exception:', err?.message);
    throw err;
  }
}

export async function uploadAvatarToSupabase(localUri: string, userId: string): Promise<string> {
  console.log('[DB] Uploading avatar...', localUri);

  try {
    const response = await fetch(localUri);
    if (!response.ok) {
      throw new Error(`Failed to read image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error('Image file is empty');
    }

    const uriLower = localUri.toLowerCase();
    let ext = 'jpg';
    let contentType = 'image/jpeg';
    if (uriLower.includes('.png')) {
      ext = 'png';
      contentType = 'image/png';
    } else if (uriLower.includes('.webp')) {
      ext = 'webp';
      contentType = 'image/webp';
    }

    const filePath = `avatars/${userId}_${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from('audio').upload(filePath, arrayBuffer, {
      contentType,
      upsert: true,
      duplex: 'half',
    });

    if (error) {
      console.error('[DB] Avatar upload error:', error.message);
      throw new Error(error.message);
    }

    const { data: publicUrlData } = supabase.storage.from('audio').getPublicUrl(filePath);
    if (!publicUrlData.publicUrl) {
      throw new Error('Failed to generate public URL for avatar');
    }
    return publicUrlData.publicUrl;
  } catch (err: any) {
    console.error('[DB] uploadAvatar exception:', err?.message);
    throw err;
  }
}

export type UserProfilePatch = {
  avatar?: string;
  display_name?: string;
  bio?: string;
  language?: string;
};

export async function updateUserProfileInDB(userId: string, patch: UserProfilePatch): Promise<void> {
  if (!isClientDBAvailable()) {
    throw new Error('Base de données non disponible');
  }
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;

  const { error } = await supabase.from('users').update(Object.fromEntries(entries as [string, string][])).eq('id', userId);
  if (error) {
    console.error('[DB] updateUserProfile error:', error.message);
    throw new Error(error.message);
  }
}

export async function createJokeInDB(joke: {
  id: string;
  userId: string;
  title: string;
  audioUri: string;
  duration: number;
  category: string;
  tags: string[];
  language: string;
  level: string;
  allowComments: boolean;
}, user?: User): Promise<void> {
  // If user object is provided, ensure the record exists in the 'users' table
  // to prevent foreign key violations.
  if (user) {
    await ensureUserRecordExists(user);
  }

  const { error } = await supabase.from('jokes').insert({
    id: joke.id,
    user_id: joke.userId,
    title: joke.title,
    audio_uri: joke.audioUri,
    duration: joke.duration,
    category: joke.category,
    tags: joke.tags,
    language: joke.language,
    level: joke.level,
    allow_comments: joke.allowComments,
    reactions: { '😂': 0, '🤣': 0, '😭': 0, '💀': 0, '👏': 0, '❤️': 0 },
    comments_count: 0,
    is_trending: false,
    is_joke_of_day: false,
    average_rating: 0,
    total_ratings: 0,
  });

  if (error) {
    console.error('[DB] Error creating joke:', error.message);
    
    // If it's a foreign key error and we didn't have the user object yet, 
    // it's a strong sign the user record is missing.
    if (error.message.includes('foreign key constraint') && !user) {
      console.warn('[DB] Joke creation failed due to missing user record. Consider passing the user object.');
    }
    
    throw new Error(error.message);
  }

  await adjustUserCounter(joke.userId, 'jokes_count', 1);
  console.log('[DB] Joke created:', joke.id);
}

export async function createVideoInDB(video: {
  id: string;
  userId: string;
  title: string;
  videoUri: string;
  thumbnailUri?: string;
  duration: number;
  category: string;
  tags: string[];
  language: string;
  level: string;
  allowComments: boolean;
}, user?: User): Promise<void> {
  if (user) {
    await ensureUserRecordExists(user);
  }

  const { error } = await supabase.from('videos').insert({
    id: video.id,
    user_id: video.userId,
    title: video.title,
    video_uri: video.videoUri,
    thumbnail_uri: video.thumbnailUri || null,
    duration: video.duration,
    category: video.category,
    tags: video.tags,
    language: video.language,
    level: video.level,
    allow_comments: video.allowComments,
    reactions: { '😂': 0, '🤣': 0, '😭': 0, '💀': 0, '👏': 0, '❤️': 0 },
    comments_count: 0,
    is_trending: false,
    average_rating: 0,
    total_ratings: 0,
  });

  if (error) {
    console.error('[DB] Error creating video:', error.message);
    if (error.message.includes('does not exist') || error.code === '42P01') {
      console.warn('[DB] videos table missing — run supabase-videos.sql');
    }
    throw new Error(error.message);
  }

  await adjustUserCounter(video.userId, 'jokes_count', 1);
  console.log('[DB] Video created:', video.id);
}

export async function toggleReactionInDB(jokeId: string, userId: string, emoji: ReactionEmoji): Promise<{ added: boolean }> {
  try {
    const { data: existing } = await supabase
      .from('reactions')
      .select('id')
      .eq('joke_id', jokeId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .single();

    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id);

      const { data: joke } = await supabase.from('jokes').select('reactions').eq('id', jokeId).single();
      if (joke?.reactions) {
        const reactions = { ...joke.reactions };
        reactions[emoji] = Math.max(0, (reactions[emoji] || 0) - 1);
        await supabase.from('jokes').update({ reactions }).eq('id', jokeId);
      }

      return { added: false };
    } else {
      await supabase.from('reactions').insert({ joke_id: jokeId, user_id: userId, emoji });

      const { data: joke } = await supabase.from('jokes').select('reactions').eq('id', jokeId).single();
      if (joke?.reactions) {
        const reactions = { ...joke.reactions };
        reactions[emoji] = (reactions[emoji] || 0) + 1;
        await supabase.from('jokes').update({ reactions }).eq('id', jokeId);
      }

      return { added: true };
    }
  } catch (err: any) {
    console.error('[DB] toggleReaction error:', err?.message);
    throw err;
  }
}

export async function rateJokeInDB(jokeId: string, userId: string, rating: number): Promise<{ averageRating: number; totalRatings: number }> {
  try {
    const { data: existing } = await supabase
      .from('ratings')
      .select('id')
      .eq('joke_id', jokeId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      await supabase.from('ratings').update({ rating }).eq('id', existing.id);
    } else {
      await supabase.from('ratings').insert({ joke_id: jokeId, user_id: userId, rating });
    }

    const { data: ratings } = await supabase
      .from('ratings')
      .select('rating')
      .eq('joke_id', jokeId);

    const total = ratings?.length || 0;
    const avg = total > 0
      ? Math.round((ratings!.reduce((sum: number, r: any) => sum + r.rating, 0) / total) * 10) / 10
      : 0;

    await supabase.from('jokes').update({ average_rating: avg, total_ratings: total }).eq('id', jokeId);

    return { averageRating: avg, totalRatings: total };
  } catch (err: any) {
    console.error('[DB] rateJoke error:', err?.message);
    throw err;
  }
}

export async function toggleFollowInDB(followerId: string, followingId: string): Promise<{ following: boolean }> {
  try {
    const { data: existing } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .single();

    if (existing) {
      await supabase.from('follows').delete().eq('id', existing.id);
      await adjustUserCounter(followingId, 'followers_count', -1);
      await adjustUserCounter(followerId, 'following_count', -1);
      return { following: false };
    } else {
      await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId });
      await adjustUserCounter(followingId, 'followers_count', 1);
      await adjustUserCounter(followerId, 'following_count', 1);
      return { following: true };
    }
  } catch (err: any) {
    console.error('[DB] toggleFollow error:', err?.message);
    throw err;
  }
}

export async function deleteJokeFromDB(jokeId: string, audioUri: string): Promise<void> {
  console.log('[DB] Deleting joke:', jokeId);
  try {
    const { data: jokeRow } = await supabase.from('jokes').select('user_id').eq('id', jokeId).single();

    if (audioUri && audioUri.includes('/storage/v1/object/public/audio/')) {
      const storagePath = audioUri.split('/storage/v1/object/public/audio/')[1];
      if (storagePath) {
        console.log('[DB] Deleting audio file from storage:', storagePath);
        const { error: storageError } = await supabase.storage
          .from('audio')
          .remove([storagePath]);
        if (storageError) {
          console.warn('[DB] Failed to delete audio file:', storageError.message);
        }
      }
    }

    await supabase.from('reactions').delete().eq('joke_id', jokeId);
    await supabase.from('ratings').delete().eq('joke_id', jokeId);
    await supabase.from('comments').delete().eq('joke_id', jokeId);

    const { error } = await supabase.from('jokes').delete().eq('id', jokeId);
    if (error) {
      console.error('[DB] Error deleting joke:', error.message);
      throw new Error(error.message);
    }

    if (jokeRow?.user_id) {
      await adjustUserCounter(jokeRow.user_id, 'jokes_count', -1);
    }
    console.log('[DB] Joke deleted:', jokeId);
  } catch (err: any) {
    console.error('[DB] deleteJoke exception:', err?.message);
    throw err;
  }
}

export async function deleteVideoFromDB(videoId: string, videoUri: string): Promise<void> {
  console.log('[DB] Deleting video:', videoId);
  try {
    const { data: videoRow } = await supabase.from('videos').select('user_id').eq('id', videoId).single();

    if (videoUri && videoUri.includes('/storage/v1/object/public/videos/')) {
      const storagePath = videoUri.split('/storage/v1/object/public/videos/')[1];
      if (storagePath) {
        console.log('[DB] Deleting video file from storage:', storagePath);
        const { error: storageError } = await supabase.storage
          .from('videos')
          .remove([storagePath]);
        if (storageError) {
          console.warn('[DB] Failed to delete video file:', storageError.message);
        }
      }
    }

    const { error } = await supabase.from('videos').delete().eq('id', videoId);
    if (error) {
      console.error('[DB] Error deleting video:', error.message);
      throw new Error(error.message);
    }

    if (videoRow?.user_id) {
      await adjustUserCounter(videoRow.user_id, 'jokes_count', -1);
    }
    console.log('[DB] Video deleted:', videoId);
  } catch (err: any) {
    console.error('[DB] deleteVideo exception:', err?.message);
    throw err;
  }
}

export async function deleteUserDataFromDB(userId: string): Promise<void> {
  console.log('[DB] Deleting user data for:', userId);
  try { await supabase.from('reactions').delete().eq('user_id', userId); } catch (e) { console.warn('[DB] delete reactions:', e); }
  try { await supabase.from('ratings').delete().eq('user_id', userId); } catch (e) { console.warn('[DB] delete ratings:', e); }
  try { await supabase.from('comments').delete().eq('user_id', userId); } catch (e) { console.warn('[DB] delete comments:', e); }
  try { await supabase.from('follows').delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`); } catch (e) { console.warn('[DB] delete follows:', e); }
  try { await supabase.from('blocked_users').delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`); } catch (e) { console.warn('[DB] delete blocked_users:', e); }
  try { await supabase.from('reports').delete().eq('reporter_id', userId); } catch (e) { console.warn('[DB] delete reports:', e); }
  try { await supabase.from('jokes').delete().eq('user_id', userId); } catch (e) { console.warn('[DB] delete jokes:', e); }
  try { await supabase.from('videos').delete().eq('user_id', userId); } catch (e) { console.warn('[DB] delete videos:', e); }
  try { await supabase.from('users').delete().eq('id', userId); } catch (e) { console.warn('[DB] delete user:', e); }
  console.log('[DB] User data deleted');
}

export async function updateUserProfile(userId: string, updates: Partial<User>): Promise<User | null> {
  console.log('[DB] Updating user profile for:', userId, updates);
  try {
    const dbUpdates: any = {};
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.language !== undefined) dbUpdates.language = updates.language;
    if (updates.role !== undefined) dbUpdates.role = updates.role;

    const { data, error } = await supabase
      .from('users')
      .update(dbUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error updating profile:', error.message);
      throw new Error(error.message);
    }

    return mapDbUserToUser(data);
  } catch (err: any) {
    console.error('[DB] updateUserProfile exception:', err?.message);
    throw err;
  }
}

import { supabase, isSupabaseConfigured } from './supabase';
import { User, Joke, ReactionEmoji } from '@/types';


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

function mapDbUserToUser(row: any): User {
  return {
    id: row.id,
    username: row.username || '',
    displayName: row.display_name || row.username || '',
    avatar: row.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.username || 'U')}&background=1565C0&color=fff&size=150`,
    bio: row.bio || '',
    language: row.language || 'FR',
    role: row.role || 'visitor',
    jokesCount: row.jokes_count || 0,
    totalLikes: row.total_likes || 0,
    followersCount: row.followers_count || 0,
    followingCount: row.following_count || 0,
    badges: row.badges || [],
    createdAt: row.created_at || '',
    isFollowing: false,
  };
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
      role: 'visitor' as const,
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

export async function uploadAudioToSupabase(localUri: string, jokeId: string): Promise<string> {
  console.log('[DB] Uploading audio to Supabase Storage...', localUri);

  try {
    const fileName = `${jokeId}_${Date.now()}.m4a`;
    const filePath = `jokes/${fileName}`;

    const response = await fetch(localUri);
    if (!response.ok) {
      console.error('[DB] Failed to fetch local audio file, status:', response.status);
      throw new Error('Failed to read audio file');
    }
    const blob = await response.blob();
    console.log('[DB] Audio blob size:', blob.size, 'type:', blob.type);

    if (blob.size === 0) {
      throw new Error('Audio file is empty');
    }

    const { data, error } = await supabase.storage
      .from('audio')
      .upload(filePath, blob, {
        contentType: 'audio/mp4',
        upsert: true,
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
    return publicUrlData.publicUrl;
  } catch (err: any) {
    console.error('[DB] uploadAudio exception:', err?.message);
    throw err;
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
}): Promise<void> {
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
    throw new Error(error.message);
  }
  console.log('[DB] Joke created:', joke.id);
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
      return { following: false };
    } else {
      await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId });
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

    const { error } = await supabase.from('jokes').delete().eq('id', jokeId);
    if (error) {
      console.error('[DB] Error deleting joke:', error.message);
      throw new Error(error.message);
    }
    console.log('[DB] Joke deleted:', jokeId);
  } catch (err: any) {
    console.error('[DB] deleteJoke exception:', err?.message);
    throw err;
  }
}

export async function deleteUserDataFromDB(userId: string): Promise<void> {
  console.log('[DB] Deleting user data for:', userId);
  try { await supabase.from('reactions').delete().eq('user_id', userId); } catch (e) { console.warn('[DB] delete reactions:', e); }
  try { await supabase.from('ratings').delete().eq('user_id', userId); } catch (e) { console.warn('[DB] delete ratings:', e); }
  try { await supabase.from('follows').delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`); } catch (e) { console.warn('[DB] delete follows:', e); }
  try { await supabase.from('jokes').delete().eq('user_id', userId); } catch (e) { console.warn('[DB] delete jokes:', e); }
  try { await supabase.from('users').delete().eq('id', userId); } catch (e) { console.warn('[DB] delete user:', e); }
  console.log('[DB] User data deleted');
}

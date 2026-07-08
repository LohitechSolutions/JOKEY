import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { ImageJoke } from '@/types';
import {
  IMAGE_JOKE_STORAGE_BUCKET,
  IMAGE_JOKE_STORAGE_PREFIX,
} from '@/constants/app-config';

const LOCAL_IMAGE_JOKES_KEY = 'joky_image_jokes';
const IMAGE_JOKES_SETUP_HINT =
  'Run rork-JOKEY-main/expo/supabase-image-jokes.sql in the Supabase SQL Editor (creates image_jokes table and storage policies).';

function storagePathFromPublicUrl(imageUrl: string): string | null {
  const bucketMarker = `/object/public/${IMAGE_JOKE_STORAGE_BUCKET}/`;
  const bucketIdx = imageUrl.indexOf(bucketMarker);
  if (bucketIdx >= 0) {
    return imageUrl.slice(bucketIdx + bucketMarker.length);
  }

  const legacyMarker = '/object/public/image-jokes/';
  const legacyIdx = imageUrl.indexOf(legacyMarker);
  if (legacyIdx >= 0) {
    return imageUrl.slice(legacyIdx + legacyMarker.length);
  }

  return null;
}

function mapRow(row: Record<string, unknown>): ImageJoke {
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    imageUrl: String(row.image_url ?? ''),
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

async function readLocalImageJokes(): Promise<ImageJoke[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_IMAGE_JOKES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ImageJoke[];
  } catch {
    return [];
  }
}

async function writeLocalImageJokes(jokes: ImageJoke[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_IMAGE_JOKES_KEY, JSON.stringify(jokes));
}

export async function fetchImageJokesFromDB(): Promise<ImageJoke[]> {
  if (!isSupabaseConfigured) {
    const local = await readLocalImageJokes();
    return local.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  const { data, error } = await supabase
    .from('image_jokes')
    .select('id, title, image_url, created_by, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[ImageJokes] fetch error:', error.message);
    return readLocalImageJokes();
  }

  return (data ?? []).map(mapRow);
}

export async function uploadImageJokeToSupabase(
  localUri: string,
  jokeId: string
): Promise<string> {
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

  const filePath = `${IMAGE_JOKE_STORAGE_PREFIX}/${jokeId}_${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(IMAGE_JOKE_STORAGE_BUCKET).upload(filePath, arrayBuffer, {
    contentType,
    upsert: true,
    duplex: 'half',
  });

  if (error) {
    if (error.message.toLowerCase().includes('bucket not found')) {
      throw new Error(
        `Storage bucket "${IMAGE_JOKE_STORAGE_BUCKET}" is missing in Supabase. ${IMAGE_JOKES_SETUP_HINT}`
      );
    }
    throw new Error(error.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from(IMAGE_JOKE_STORAGE_BUCKET)
    .getPublicUrl(filePath);
  if (!publicUrlData.publicUrl) {
    throw new Error('Failed to generate public URL for image joke');
  }

  return publicUrlData.publicUrl;
}

export async function createImageJokeInDB(
  title: string,
  imageUrl: string,
  createdBy: string
): Promise<ImageJoke> {
  const id = `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();
  const joke: ImageJoke = {
    id,
    title: title.trim(),
    imageUrl,
    createdBy,
    createdAt,
  };

  if (!isSupabaseConfigured) {
    const local = await readLocalImageJokes();
    local.unshift(joke);
    await writeLocalImageJokes(local);
    return joke;
  }

  const { error } = await supabase.from('image_jokes').insert({
    id,
    title: joke.title,
    image_url: imageUrl,
    created_by: createdBy,
  });

  if (error) {
    if (
      error.code === 'PGRST205' ||
      error.message.toLowerCase().includes('image_jokes')
    ) {
      throw new Error(`Database table image_jokes is not set up. ${IMAGE_JOKES_SETUP_HINT}`);
    }
    throw new Error(error.message);
  }

  return joke;
}

export async function deleteImageJokeFromDB(joke: ImageJoke): Promise<void> {
  if (!isSupabaseConfigured) {
    const local = await readLocalImageJokes();
    await writeLocalImageJokes(local.filter((item) => item.id !== joke.id));
    return;
  }

  const { error } = await supabase.from('image_jokes').delete().eq('id', joke.id);
  if (error) {
    throw new Error(error.message);
  }

  try {
    const storagePath = storagePathFromPublicUrl(joke.imageUrl);
    if (storagePath) {
      await supabase.storage.from(IMAGE_JOKE_STORAGE_BUCKET).remove([storagePath]);
      const legacyBucketPath = storagePath.startsWith('drawings/')
        ? storagePath
        : null;
      if (legacyBucketPath) {
        await supabase.storage.from('image-jokes').remove([legacyBucketPath]);
      }
    }
  } catch (err) {
    console.warn('[ImageJokes] storage delete failed:', err);
  }
}

export async function publishImageJoke(
  title: string,
  localImageUri: string,
  createdBy: string
): Promise<ImageJoke> {
  const id = `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const imageUrl = isSupabaseConfigured
    ? await uploadImageJokeToSupabase(localImageUri, id)
    : localImageUri;

  return createImageJokeInDB(title, imageUrl, createdBy);
}

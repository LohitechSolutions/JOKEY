import { Joke, Video } from '@/types';

const ADULT_CATEGORIES = new Set(['humour-noir']);

export function isAdultContent(level: 'all' | 'adult', category: string): boolean {
  return level === 'adult' || ADULT_CATEGORIES.has(category);
}

export function filterJokes(
  jokes: Joke[],
  options: { safeMode: boolean; blockedUserIds: string[] }
): Joke[] {
  return jokes.filter((joke) => {
    if (options.blockedUserIds.includes(joke.userId)) return false;
    if (options.safeMode && isAdultContent(joke.level, joke.category)) return false;
    return true;
  });
}

export function filterVideos(
  videos: Video[],
  options: { safeMode: boolean; blockedUserIds: string[] }
): Video[] {
  return videos.filter((video) => {
    if (options.blockedUserIds.includes(video.userId)) return false;
    if (options.safeMode && isAdultContent(video.level, video.category)) return false;
    return true;
  });
}

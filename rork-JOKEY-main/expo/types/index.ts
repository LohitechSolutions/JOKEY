export type UserRole = 'creator' | 'visitor';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  language: string;
  role: UserRole;
  jokesCount: number;
  totalLikes: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  badges: Badge[];
  createdAt: string;
  isAdmin?: boolean;
}

export interface ImageJoke {
  id: string;
  title: string;
  imageUrl: string;
  createdBy: string | null;
  createdAt: string;
}

export interface Joke {
  id: string;
  userId: string;
  user: User;
  title: string;
  audioUri: string;
  duration: number;
  category: JokeCategory;
  tags: string[];
  language: string;
  level: 'all' | 'adult';
  allowComments: boolean;
  reactions: ReactionCounts;
  commentsCount: number;
  createdAt: string;
  isTrending: boolean;
  isJokeOfDay: boolean;
  averageRating: number;
  totalRatings: number;
}

export interface Video {
  id: string;
  userId: string;
  user: User;
  title: string;
  videoUri: string;
  thumbnailUri?: string;
  duration: number;
  category: JokeCategory;
  tags: string[];
  language: string;
  level: 'all' | 'adult';
  allowComments: boolean;
  reactions: ReactionCounts;
  commentsCount: number;
  createdAt: string;
  isTrending: boolean;
  averageRating: number;
  totalRatings: number;
}

export interface ReactionCounts {
  '😂': number;
  '🤣': number;
  '😭': number;
  '💀': number;
  '👏': number;
  '❤️': number;
}

export type ReactionEmoji = keyof ReactionCounts;

export interface Comment {
  id: string;
  userId: string;
  user: User;
  jokeId: string;
  text: string;
  createdAt: string;
  likes: number;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export type JokeCategory =
  | 'courtes'
  | 'histoires'
  | 'travail'
  | 'couple'
  | 'ecole'
  | 'geek'
  | 'sport'
  | 'clean'
  | 'humour-noir';

export interface CategoryInfo {
  id: JokeCategory;
  name: string;
  emoji: string;
  color: string;
  description: string;
}

export type FeedTab = 'jour' | 'nouveautes' | 'tendances' | 'abonnements';

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  uri: string | null;
}

export type SubscriptionPlan = 'weekly' | 'monthly';

export interface TipTransaction {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  jokeId: string;
  createdAt: string;
}

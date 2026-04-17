import { CategoryInfo, Badge } from '@/types';

export const BADGES: Badge[] = [
  { id: 'b1', name: 'Blague du jour', icon: '🏆', description: 'Votre blague a été sélectionnée comme blague du jour' },
  { id: 'b2', name: '100 likes', icon: '💯', description: 'Vous avez reçu 100 likes' },
  { id: 'b3', name: 'Top 10', icon: '🔥', description: 'Vous êtes dans le Top 10 de la semaine' },
  { id: 'b4', name: 'Créateur régulier', icon: '⭐', description: '7 jours consécutifs de publication' },
];

export const CATEGORIES: CategoryInfo[] = [
  { id: 'courtes', name: 'Courtes', emoji: '⚡', color: '#1565C0', description: 'Blagues rapides ≤20s' },
  { id: 'histoires', name: 'Histoires', emoji: '📖', color: '#42A5F5', description: 'Récits drôles 20-90s' },
  { id: 'travail', name: 'Travail', emoji: '💼', color: '#2E7D32', description: 'Humour de bureau' },
  { id: 'couple', name: 'Couple', emoji: '💕', color: '#E53935', description: 'Blagues d\'amour' },
  { id: 'ecole', name: 'École', emoji: '📚', color: '#FF8F00', description: 'Humour scolaire' },
  { id: 'geek', name: 'Geek', emoji: '🤓', color: '#7B1FA2', description: 'Tech & culture geek' },
  { id: 'sport', name: 'Sport', emoji: '⚽', color: '#00897B', description: 'Blagues sportives' },
  { id: 'clean', name: 'Tout public', emoji: '✨', color: '#0D47A1', description: 'Pour toute la famille' },
  { id: 'humour-noir', name: 'Humour noir', emoji: '🖤', color: '#263238', description: 'Humour sombre' },
];

export const REACTION_EMOJIS: { emoji: string; key: string }[] = [
  { emoji: '😂', key: '😂' },
  { emoji: '🤣', key: '🤣' },
  { emoji: '😭', key: '😭' },
  { emoji: '💀', key: '💀' },
  { emoji: '👏', key: '👏' },
  { emoji: '❤️', key: '❤️' },
];

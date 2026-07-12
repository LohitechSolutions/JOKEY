export const APP_VERSION = '1.15';
export const PRESERVED_STORAGE_KEYS = [
  'joky_preamble_accepted',
  'joky_settings',
] as const;
export const PRIVACY_POLICY_URL = 'https://jokey.app/privacy';
export const TERMS_URL = 'https://jokey.app/terms';
export const SUPPORT_EMAIL = 'support@jokey.app';
export const PRIVACY_EMAIL = 'privacy@jokey.app';
export const MODERATION_EMAIL = 'moderation@jokey.app';

/** Image jokes are stored in the existing public `audio` bucket (see avatar uploads). */
export const IMAGE_JOKE_STORAGE_BUCKET = 'audio';
export const IMAGE_JOKE_STORAGE_PREFIX = 'image-jokes/drawings';

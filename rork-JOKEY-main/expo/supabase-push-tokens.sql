-- Run this in the Supabase SQL Editor to enable push notification token storage.
-- Tokens are Expo push tokens (ExponentPushToken[...]) used with https://exp.host/--/api/v2/push/send

CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  device_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own push tokens" ON push_tokens;
CREATE POLICY "Users manage their own push tokens"
  ON push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Example: send a notification from a Supabase Edge Function or cron job
-- POST https://exp.host/--/api/v2/push/send
-- {
--   "to": "<ExponentPushToken from push_tokens.token>",
--   "title": "New joke from @username",
--   "body": "Check out their latest blague!",
--   "data": { "type": "joke", "id": "<joke_uuid>" },
--   "channelId": "content"
-- }

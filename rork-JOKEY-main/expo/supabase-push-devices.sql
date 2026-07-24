-- Push notification device tokens for Jokey (Expo Push + Supabase)
-- Run in the Supabase SQL Editor before deploying the Edge Function.

CREATE TABLE IF NOT EXISTS push_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
  device_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_push_devices_user_id ON push_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_enabled ON push_devices(enabled) WHERE enabled = TRUE;

ALTER TABLE push_devices ENABLE ROW LEVEL SECURITY;

-- Users manage only their own device rows
DROP POLICY IF EXISTS "Users can select own push devices" ON push_devices;
CREATE POLICY "Users can select own push devices"
  ON push_devices FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own push devices" ON push_devices;
CREATE POLICY "Users can insert own push devices"
  ON push_devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own push devices" ON push_devices;
CREATE POLICY "Users can update own push devices"
  ON push_devices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own push devices" ON push_devices;
CREATE POLICY "Users can delete own push devices"
  ON push_devices FOR DELETE
  USING (auth.uid() = user_id);

-- Service role (Edge Function) bypasses RLS automatically.

-- Social connections table (Google Business OAuth tokens)
CREATE TABLE IF NOT EXISTS social_connections (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id      UUID        REFERENCES businesses(id) ON DELETE CASCADE,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  platform         TEXT        NOT NULL,
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  platform_user_id TEXT,
  platform_username TEXT,
  is_active        BOOLEAN     DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, platform)
);

-- RLS
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own connections"
  ON social_connections
  FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

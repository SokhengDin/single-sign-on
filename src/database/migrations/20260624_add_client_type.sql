DO $$ BEGIN
  CREATE TYPE client_type AS ENUM ('bot', 'backend', 'spa', 'mobile');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE client
  ADD COLUMN IF NOT EXISTS type client_type NOT NULL DEFAULT 'backend';

ALTER TABLE client
  ALTER COLUMN redirect_uris SET DEFAULT '{}';

ALTER TABLE client
  DROP CONSTRAINT IF EXISTS chk_redirect_uris;

DO $$ BEGIN
  ALTER TABLE client ADD CONSTRAINT chk_grant_types CHECK (
    grant_types <@ ARRAY['authorization_code','refresh_token','client_credentials']::TEXT[]
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE client ADD CONSTRAINT chk_scopes CHECK (
    scopes <@ ARRAY['openid','profile','introspect']::TEXT[]
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

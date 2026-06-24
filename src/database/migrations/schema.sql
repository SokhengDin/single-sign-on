-- =============================================================================
-- SSO Database — Initial Migration
-- 20260624_init_sso.sql
--
-- Rollback:
--   DROP TABLE IF EXISTS signing_key, session, token, authorization_code,
--     verification, account, linked_account, client, "user" CASCADE;
--   DROP TYPE IF EXISTS token_type, challenge_method;
--   DROP EXTENSION IF EXISTS "uuid-ossp", "pgcrypto";
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE token_type       AS ENUM ('access', 'refresh');
CREATE TYPE challenge_method AS ENUM ('S256');

-- =============================================================================
-- USER
-- Minimal internal identity — no provider-specific data here.
-- display_name and avatar_url are denormalized from account.payload on login.
-- Soft delete via deleted_at — never hard delete a user row.
-- =============================================================================

CREATE TABLE "user" (
  id           UUID        NOT NULL DEFAULT uuid_generate_v4(),
  display_name TEXT,
  avatar_url   TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ,

  CONSTRAINT pk_user PRIMARY KEY (id),
  CONSTRAINT chk_user_active_if_not_deleted CHECK (
    NOT (deleted_at IS NOT NULL AND is_active = true)
  )
);

-- =============================================================================
-- ACCOUNT
-- One row per provider per user.
-- provider:    'telegram' | 'google' | 'github' | 'apple' | anything future
-- provider_id: provider's own user identifier
-- payload:     full raw provider response — never strip, may need later
-- scope:       what user consented to share during provider OAuth
-- =============================================================================

CREATE TABLE account (
  id          UUID        NOT NULL DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL,
  provider    TEXT        NOT NULL,
  provider_id TEXT        NOT NULL,
  payload     JSONB       NOT NULL DEFAULT '{}',
  scope       TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ,

  CONSTRAINT pk_account            PRIMARY KEY (id),
  CONSTRAINT fk_account_user       FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,
  CONSTRAINT uq_account            UNIQUE (provider, provider_id),
  CONSTRAINT chk_provider          CHECK (char_length(trim(provider)) > 0),
  CONSTRAINT chk_provider_id       CHECK (char_length(trim(provider_id)) > 0)
);

-- =============================================================================
-- LINKED_ACCOUNT
-- Maps SSO user → external service user ID.
-- external_system:  'property_mgmt' | 'billing' | any future service
-- external_user_id: that service's UUID as text
-- unlinked_at:      soft unlink — never hard delete, audit trail matters
-- =============================================================================

CREATE TABLE linked_account (
  id               UUID        NOT NULL DEFAULT uuid_generate_v4(),
  user_id          UUID        NOT NULL,
  external_user_id TEXT        NOT NULL,
  external_system  TEXT        NOT NULL,
  scope            TEXT[]      NOT NULL DEFAULT '{}',
  linked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  unlinked_at      TIMESTAMPTZ,

  CONSTRAINT pk_linked_account         PRIMARY KEY (id),
  CONSTRAINT fk_linked_account_user    FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,
  CONSTRAINT uq_linked_account         UNIQUE (user_id, external_system),
  CONSTRAINT chk_external_user_id      CHECK (char_length(trim(external_user_id)) > 0),
  CONSTRAINT chk_external_system       CHECK (char_length(trim(external_system)) > 0),
  CONSTRAINT chk_no_self_link          CHECK (external_user_id != user_id::text)
);

-- =============================================================================
-- CLIENT
-- Every service that consumes your SSO must register here.
-- client_id:     public, sent in OAuth requests — safe to expose
-- client_secret: SHA-256 hashed — never store raw
-- redirect_uris: exact match whitelist — no wildcards
-- is_public:     true  = PKCE required, no secret (SPA, mobile)
--                false = confidential, secret required (server-side app)
-- =============================================================================

CREATE TABLE client (
  id            UUID        NOT NULL DEFAULT uuid_generate_v4(),
  name          TEXT        NOT NULL,
  client_id     TEXT        NOT NULL,
  client_secret TEXT,
  redirect_uris TEXT[]      NOT NULL,
  scopes        TEXT[]      NOT NULL DEFAULT '{"openid","profile"}',
  grant_types   TEXT[]      NOT NULL DEFAULT '{"authorization_code","refresh_token"}',
  is_public     BOOLEAN     NOT NULL DEFAULT false,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ,

  CONSTRAINT pk_client             PRIMARY KEY (id),
  CONSTRAINT uq_client_id          UNIQUE (client_id),
  CONSTRAINT chk_client_name       CHECK (char_length(trim(name)) > 0),
  CONSTRAINT chk_client_id         CHECK (char_length(trim(client_id)) > 0),
  CONSTRAINT chk_redirect_uris     CHECK (cardinality(redirect_uris) > 0),
  CONSTRAINT chk_secret_or_public  CHECK (
    (is_public = true  AND client_secret IS NULL) OR
    (is_public = false AND client_secret IS NOT NULL)
  )
);

-- =============================================================================
-- AUTHORIZATION_CODE
-- Short-lived, single-use. Issued by /authorize, consumed by /token.
-- code_challenge:  BASE64URL(SHA-256(code_verifier)) — PKCE
-- nonce:           replay attack mitigation for id_token
-- auth_time:       when user actually authenticated — goes into id_token claim
-- Max TTL: 10 minutes, enforced at DB level.
-- =============================================================================

CREATE TABLE authorization_code (
  id               UUID             NOT NULL DEFAULT uuid_generate_v4(),
  code             TEXT             NOT NULL,
  user_id          UUID             NOT NULL,
  client_id        UUID             NOT NULL,
  redirect_uri     TEXT             NOT NULL,
  scopes           TEXT[]           NOT NULL,
  code_challenge   TEXT,
  challenge_method challenge_method,
  nonce            TEXT,
  auth_time        TIMESTAMPTZ      NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ      NOT NULL,
  used_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT now(),

  CONSTRAINT pk_authorization_code  PRIMARY KEY (id),
  CONSTRAINT fk_auth_code_user      FOREIGN KEY (user_id)   REFERENCES "user"(id) ON DELETE CASCADE,
  CONSTRAINT fk_auth_code_client    FOREIGN KEY (client_id) REFERENCES client(id) ON DELETE CASCADE,
  CONSTRAINT uq_auth_code           UNIQUE (code),
  CONSTRAINT chk_code_nonempty      CHECK (char_length(trim(code)) > 0),
  CONSTRAINT chk_code_expiry        CHECK (expires_at > created_at),
  CONSTRAINT chk_code_max_ttl       CHECK (expires_at <= created_at + interval '10 minutes'),
  CONSTRAINT chk_used_after_issued  CHECK (used_at IS NULL OR used_at >= created_at),
  CONSTRAINT chk_pkce_pair          CHECK (
    (code_challenge IS NOT NULL AND challenge_method IS NOT NULL) OR
    (code_challenge IS NULL     AND challenge_method IS NULL)
  )
);

-- =============================================================================
-- TOKEN
-- Access and refresh tokens. Raw value NEVER stored — SHA-256 hash only.
--
-- Issue:    raw    = crypto.randomBytes(32).toString('hex')
--           stored = SHA-256(raw)
--           return raw to client — never touches disk again
--
-- Validate: incoming token → SHA-256 → lookup token_hash
--
-- last_four: last 4 chars of raw token, for "active sessions" UI display only
-- =============================================================================

CREATE TABLE token (
  id          UUID        NOT NULL DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL,
  client_id   UUID        NOT NULL,
  type        token_type  NOT NULL,
  token_hash  TEXT        NOT NULL,
  last_four   VARCHAR(4),
  scopes      TEXT[]      NOT NULL DEFAULT '{}',
  ip_address  INET,
  user_agent  TEXT,
  expires_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_token              PRIMARY KEY (id),
  CONSTRAINT fk_token_user         FOREIGN KEY (user_id)   REFERENCES "user"(id)  ON DELETE CASCADE,
  CONSTRAINT fk_token_client       FOREIGN KEY (client_id) REFERENCES client(id)  ON DELETE CASCADE,
  CONSTRAINT uq_token_hash         UNIQUE (token_hash),
  CONSTRAINT chk_token_hash_length CHECK (char_length(token_hash) >= 64),
  CONSTRAINT chk_revoked_order     CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  CONSTRAINT chk_refresh_expiry    CHECK (type != 'refresh' OR expires_at IS NOT NULL)
);

-- =============================================================================
-- SESSION
-- One session per login event, scoped to a user + client pair.
-- Revoking a session must also revoke its token — done atomically in a
-- transaction at the application layer.
-- =============================================================================

CREATE TABLE session (
  id          UUID        NOT NULL DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL,
  client_id   UUID        NOT NULL,
  token_id    UUID        NOT NULL,
  ip_address  INET,
  user_agent  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_session          PRIMARY KEY (id),
  CONSTRAINT fk_session_user     FOREIGN KEY (user_id)   REFERENCES "user"(id)  ON DELETE CASCADE,
  CONSTRAINT fk_session_client   FOREIGN KEY (client_id) REFERENCES client(id)  ON DELETE CASCADE,
  CONSTRAINT fk_session_token    FOREIGN KEY (token_id)  REFERENCES token(id)   ON DELETE CASCADE,
  CONSTRAINT chk_session_expiry  CHECK (expires_at > created_at),
  CONSTRAINT chk_revoked_order   CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

-- =============================================================================
-- VERIFICATION
-- Short-lived single-use tokens for any out-of-band verification:
--   identifier: 'email_verify' | 'password_reset' | 'magic_link' | 'phone_otp'
--   value:      opaque token (hash if sensitive)
--   metadata:   arbitrary JSON — { email, redirect_uri, user_id, ... }
-- Hard ceiling of 1 hour TTL enforced at DB level for all types.
-- =============================================================================

CREATE TABLE verification (
  id          UUID        NOT NULL DEFAULT uuid_generate_v4(),
  identifier  TEXT        NOT NULL,
  value       TEXT        NOT NULL,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_verification         PRIMARY KEY (id),
  CONSTRAINT uq_verification_value   UNIQUE (value),
  CONSTRAINT chk_identifier          CHECK (char_length(trim(identifier)) > 0),
  CONSTRAINT chk_verification_expiry CHECK (expires_at > created_at),
  CONSTRAINT chk_verification_max_ttl CHECK (expires_at <= created_at + interval '1 hour'),
  CONSTRAINT chk_used_after_created  CHECK (used_at IS NULL OR used_at >= created_at)
);

-- =============================================================================
-- SIGNING_KEY
-- RSA or EC key pairs for signing id_tokens (JWTs).
-- private_key: encrypted at rest by application layer (AES-256-GCM).
-- public_key:  exposed via /.well-known/jwks.json.
-- kid:         key ID in JWT header — clients use to pick the right public key.
-- Rotation:    new key is_active = true,
--              old key rotated_at = now(), is_active = false.
--              Keep old keys until all tokens they signed have expired.
-- =============================================================================

CREATE TABLE signing_key (
  id          UUID        NOT NULL DEFAULT uuid_generate_v4(),
  kid         TEXT        NOT NULL,
  algorithm   TEXT        NOT NULL DEFAULT 'RS256',
  private_key TEXT        NOT NULL,
  public_key  TEXT        NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  rotated_at  TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_signing_key          PRIMARY KEY (id),
  CONSTRAINT uq_kid                  UNIQUE (kid),
  CONSTRAINT chk_kid                 CHECK (char_length(trim(kid)) > 0),
  CONSTRAINT chk_algorithm           CHECK (algorithm IN ('RS256','RS384','RS512','ES256','ES384','ES512')),
  CONSTRAINT chk_private_key         CHECK (char_length(trim(private_key)) > 0),
  CONSTRAINT chk_public_key          CHECK (char_length(trim(public_key)) > 0),
  CONSTRAINT chk_rotation_state      CHECK (
    (is_active = true) OR
    (is_active = false AND rotated_at IS NOT NULL)
  )
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- user
CREATE INDEX idx_user_active     ON "user" (is_active)  WHERE deleted_at IS NULL;

-- account
CREATE INDEX idx_account_user    ON account (user_id);
CREATE INDEX idx_account_lookup  ON account (provider, provider_id);

-- linked_account
CREATE INDEX idx_linked_user     ON linked_account (user_id);
CREATE INDEX idx_linked_system   ON linked_account (external_system);
CREATE INDEX idx_linked_active   ON linked_account (user_id, external_system)
  WHERE unlinked_at IS NULL;

-- client
CREATE INDEX idx_client_lookup   ON client (client_id) WHERE is_active = true;

-- authorization_code
CREATE INDEX idx_code_lookup     ON authorization_code (code)       WHERE used_at IS NULL;
CREATE INDEX idx_code_user       ON authorization_code (user_id);
CREATE INDEX idx_code_expires    ON authorization_code (expires_at);

-- token
CREATE INDEX idx_token_hash      ON token (token_hash);
CREATE INDEX idx_token_user      ON token (user_id);
CREATE INDEX idx_token_expires   ON token (expires_at);
CREATE INDEX idx_token_active    ON token (user_id, client_id)      WHERE revoked_at IS NULL;

-- session
CREATE INDEX idx_session_user    ON session (user_id);
CREATE INDEX idx_session_expires ON session (expires_at);
CREATE INDEX idx_session_active  ON session (user_id, client_id)    WHERE revoked_at IS NULL;

-- verification
CREATE INDEX idx_verify_lookup   ON verification (value)            WHERE used_at IS NULL;
CREATE INDEX idx_verify_type     ON verification (identifier);
CREATE INDEX idx_verify_expires  ON verification (expires_at);

-- signing_key
CREATE INDEX idx_key_active      ON signing_key (is_active)         WHERE is_active = true;
CREATE INDEX idx_key_kid         ON signing_key (kid);
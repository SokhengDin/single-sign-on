import { Effect } from "effect"
import { AppConfig } from "@/config/index.ts"
import { OidcDiscovery } from "./discovery.type.ts"

export const makeDiscovery = Effect.fn("discovery")(function* () {
  const config = yield* AppConfig
  const base   = config.appUrl

  return ({
    issuer:                                base,
    authorization_endpoint:                `${base}/authorize`,
    token_endpoint:                        `${base}/token`,
    userinfo_endpoint:                     `${base}/userinfo`,
    jwks_uri:                              `${base}/.well-known/jwks.json`,
    revocation_endpoint:                   `${base}/revoke`,
    introspection_endpoint:                `${base}/introspect`,
    response_types_supported:              ["code"],
    subject_types_supported:               ["public"],
    id_token_signing_alg_values_supported: ["RS256", "ES256"],
    scopes_supported:                      ["openid", "profile", "email"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    grant_types_supported:                 ["authorization_code", "refresh_token"],
    claims_supported:                      ["sub", "iss", "aud", "exp", "iat", "name", "picture", "email"],
  })
})

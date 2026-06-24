import { Schema } from "effect"

export class OidcDiscovery extends Schema.Class<OidcDiscovery>("OidcDiscovery")({
  issuer:                                Schema.String,
  authorization_endpoint:                Schema.String,
  token_endpoint:                        Schema.String,
  userinfo_endpoint:                     Schema.String,
  jwks_uri:                              Schema.String,
  revocation_endpoint:                   Schema.String,
  introspection_endpoint:                Schema.String,
  response_types_supported:              Schema.Array(Schema.String),
  subject_types_supported:               Schema.Array(Schema.String),
  id_token_signing_alg_values_supported: Schema.Array(Schema.String),
  scopes_supported:                      Schema.Array(Schema.String),
  token_endpoint_auth_methods_supported: Schema.Array(Schema.String),
  grant_types_supported:                 Schema.Array(Schema.String),
  claims_supported:                      Schema.Array(Schema.String),
}) {}

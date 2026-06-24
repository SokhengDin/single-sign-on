import { Schema } from "effect"

export class TokenRequest extends Schema.Class<TokenRequest>("TokenRequest")({
  grant_type:    Schema.String,
  code:          Schema.optional(Schema.String),
  redirect_uri:  Schema.optional(Schema.String),
  code_verifier: Schema.optional(Schema.String),
  refresh_token: Schema.optional(Schema.String),
  client_id:     Schema.optional(Schema.String),
  client_secret: Schema.optional(Schema.String),
}) {}

export class TokenResponse extends Schema.Class<TokenResponse>("TokenResponse")({
  access_token:  Schema.String,
  token_type:    Schema.String,
  expires_in:    Schema.Number,
  refresh_token: Schema.optional(Schema.String),
  id_token:      Schema.optional(Schema.String),
  scope:         Schema.String,
}) {}

export class RevokeRequest extends Schema.Class<RevokeRequest>("RevokeRequest")({
  token:           Schema.String,
  token_type_hint: Schema.optional(Schema.String),
}) {}

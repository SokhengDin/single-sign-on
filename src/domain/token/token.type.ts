import { Schema } from "effect"

export const TokenRequest = Schema.Struct({
  grant_type:    Schema.String,
  code:          Schema.optional(Schema.String),
  redirect_uri:  Schema.optional(Schema.String),
  code_verifier: Schema.optional(Schema.String),
  refresh_token: Schema.optional(Schema.String),
  client_id:     Schema.optional(Schema.String),
  client_secret: Schema.optional(Schema.String),
})
export type TokenRequest = Schema.Schema.Type<typeof TokenRequest>

export const TokenResponse = Schema.Struct({
  access_token:  Schema.String,
  token_type:    Schema.String,
  expires_in:    Schema.Number,
  refresh_token: Schema.optional(Schema.String),
  id_token:      Schema.optional(Schema.String),
  scope:         Schema.String,
})
export type TokenResponse = Schema.Schema.Type<typeof TokenResponse>

export const RevokeRequest = Schema.Struct({
  token:           Schema.String,
  token_type_hint: Schema.optional(Schema.String),
})
export type RevokeRequest = Schema.Schema.Type<typeof RevokeRequest>

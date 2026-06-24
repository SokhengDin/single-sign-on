import { Schema } from "effect"

export const AuthorizeParams = Schema.Struct({
  client_id:             Schema.String,
  user_id:               Schema.String,
  redirect_uri:          Schema.optional(Schema.String),
  response_type:         Schema.optional(Schema.String),
  scope:                 Schema.optional(Schema.String),
  state:                 Schema.optional(Schema.String),
  code_challenge:        Schema.optional(Schema.String),
  code_challenge_method: Schema.optional(Schema.String),
  nonce:                 Schema.optional(Schema.String),
})
export type AuthorizeParams = Schema.Schema.Type<typeof AuthorizeParams>

export const AuthorizeResponseData = Schema.Struct({
  redirect_uri: Schema.String,
})
export type AuthorizeResponseData = Schema.Schema.Type<typeof AuthorizeResponseData>

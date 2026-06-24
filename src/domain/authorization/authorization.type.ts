import { Schema } from "effect"

export class AuthorizeParams extends Schema.Class<AuthorizeParams>("AuthorizeParams")({
  client_id:             Schema.String,
  redirect_uri:          Schema.String,
  response_type:         Schema.String,
  scope:                 Schema.String,
  state:                 Schema.optional(Schema.String),
  code_challenge:        Schema.optional(Schema.String),
  code_challenge_method: Schema.optional(Schema.String),
  nonce:                 Schema.optional(Schema.String),
}) {}

export class AuthorizeResponse extends Schema.Class<AuthorizeResponse>("AuthorizeResponse")({
  redirect_uri: Schema.String,
}) {}

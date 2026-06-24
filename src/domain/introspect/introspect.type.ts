import { Schema } from "effect"

export const IntrospectRequest = Schema.Struct({
  token:           Schema.String,
  token_type_hint: Schema.optional(Schema.String),
})
export type IntrospectRequest = Schema.Schema.Type<typeof IntrospectRequest>

export const IntrospectResponse = Schema.Struct({
  active:     Schema.Boolean,
  sub:        Schema.optional(Schema.String),
  client_id:  Schema.optional(Schema.String),
  scope:      Schema.optional(Schema.String),
  exp:        Schema.optional(Schema.Number),
  iat:        Schema.optional(Schema.Number),
  token_type: Schema.optional(Schema.String),
})
export type IntrospectResponse = Schema.Schema.Type<typeof IntrospectResponse>

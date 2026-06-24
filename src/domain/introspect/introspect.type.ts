import { Schema } from "effect"

export class IntrospectRequest extends Schema.Class<IntrospectRequest>("IntrospectRequest")({
  token:           Schema.String,
  token_type_hint: Schema.optional(Schema.String),
}) {}

export class IntrospectResponse extends Schema.Class<IntrospectResponse>("IntrospectResponse")({
  active:     Schema.Boolean,
  sub:        Schema.optional(Schema.String),
  client_id:  Schema.optional(Schema.String),
  scope:      Schema.optional(Schema.String),
  exp:        Schema.optional(Schema.Number),
  iat:        Schema.optional(Schema.Number),
  token_type: Schema.optional(Schema.String),
}) {}

import { Schema } from "effect"

export const Account = Schema.Struct({
  id:          Schema.String,
  user_id:     Schema.String,
  provider:    Schema.String,
  provider_id: Schema.String,
  payload:     Schema.Unknown,
  scope:       Schema.Array(Schema.String),
  created_at:  Schema.DateTimeUtc,
  updated_at:  Schema.NullOr(Schema.DateTimeUtc),
})
export type Account = Schema.Schema.Type<typeof Account>

export const UpsertAccountInput = Schema.Struct({
  user_id:      Schema.optional(Schema.String),
  provider:     Schema.String,
  provider_id:  Schema.String,
  display_name: Schema.optional(Schema.NullOr(Schema.String)),
  avatar_url:   Schema.optional(Schema.NullOr(Schema.String)),
  payload:      Schema.optional(Schema.Unknown),
  scope:        Schema.optional(Schema.Array(Schema.String)),
})
export type UpsertAccountInput = Schema.Schema.Type<typeof UpsertAccountInput>

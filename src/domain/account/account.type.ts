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
  user_id:     Schema.String,
  provider:    Schema.String,
  provider_id: Schema.String,
  payload:     Schema.Unknown,
  scope:       Schema.Array(Schema.String),
})
export type UpsertAccountInput = Schema.Schema.Type<typeof UpsertAccountInput>

import { Schema } from "effect"

export const User = Schema.Struct({
  id:           Schema.String,
  display_name: Schema.NullOr(Schema.String),
  avatar_url:   Schema.NullOr(Schema.String),
  is_active:    Schema.Boolean,
  created_at:   Schema.DateTimeUtc,
  updated_at:   Schema.NullOr(Schema.DateTimeUtc),
  deleted_at:   Schema.NullOr(Schema.DateTimeUtc),
})
export type User = Schema.Schema.Type<typeof User>

export const LinkedAccount = Schema.Struct({
  id:               Schema.String,
  user_id:          Schema.String,
  external_user_id: Schema.String,
  external_system:  Schema.String,
  scope:            Schema.Array(Schema.String),
  linked_at:        Schema.DateTimeUtc,
  unlinked_at:      Schema.NullOr(Schema.DateTimeUtc),
})
export type LinkedAccount = Schema.Schema.Type<typeof LinkedAccount>

export const CreateUserInput = Schema.Struct({
  display_name: Schema.optional(Schema.NullOr(Schema.String)),
  avatar_url:   Schema.optional(Schema.NullOr(Schema.String)),
})
export type CreateUserInput = Schema.Schema.Type<typeof CreateUserInput>

export const UpdateUserInput = Schema.Struct({
  display_name: Schema.optional(Schema.NullOr(Schema.String)),
  avatar_url:   Schema.optional(Schema.NullOr(Schema.String)),
})
export type UpdateUserInput = Schema.Schema.Type<typeof UpdateUserInput>

export const LinkAccountInput = Schema.Struct({
  user_id:          Schema.String,
  external_user_id: Schema.String,
  external_system:  Schema.String,
  scope:            Schema.Array(Schema.String),
})
export type LinkAccountInput = Schema.Schema.Type<typeof LinkAccountInput>

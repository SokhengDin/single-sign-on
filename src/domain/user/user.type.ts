import { Schema } from "effect"

export const User = Schema.Struct({
  id:          Schema.String,
  displayName: Schema.NullOr(Schema.String),
  avatarUrl:   Schema.NullOr(Schema.String),
  isActive:    Schema.Boolean,
  createdAt:   Schema.DateTimeUtc,
  updatedAt:   Schema.NullOr(Schema.DateTimeUtc),
  deletedAt:   Schema.NullOr(Schema.DateTimeUtc),
})
export type User = Schema.Schema.Type<typeof User>

export const LinkedAccount = Schema.Struct({
  id:             Schema.String,
  userId:         Schema.String,
  externalUserId: Schema.String,
  externalSystem: Schema.String,
  scope:          Schema.Array(Schema.String),
  linkedAt:       Schema.DateTimeUtc,
  unlinkedAt:     Schema.NullOr(Schema.DateTimeUtc),
})
export type LinkedAccount = Schema.Schema.Type<typeof LinkedAccount>

export class CreateUserInput extends Schema.Class<CreateUserInput>("CreateUserInput")({
  displayName: Schema.NullOr(Schema.String),
  avatarUrl:   Schema.NullOr(Schema.String),
}) {}

export class UpdateUserInput extends Schema.Class<UpdateUserInput>("UpdateUserInput")({
  displayName: Schema.optional(Schema.NullOr(Schema.String)),
  avatarUrl:   Schema.optional(Schema.NullOr(Schema.String)),
}) {}

export class LinkAccountInput extends Schema.Class<LinkAccountInput>("LinkAccountInput")({
  userId:         Schema.String,
  externalUserId: Schema.String,
  externalSystem: Schema.String,
  scope:          Schema.Array(Schema.String),
}) {}

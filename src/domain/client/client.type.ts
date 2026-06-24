import { Schema } from "effect"

export const Client = Schema.Struct({
  id:           Schema.String,
  name:         Schema.String,
  clientId:     Schema.String,
  redirectUris: Schema.Array(Schema.String),
  scopes:       Schema.Array(Schema.String),
  grantTypes:   Schema.Array(Schema.String),
  isPublic:     Schema.Boolean,
  isActive:     Schema.Boolean,
  createdAt:    Schema.DateTimeUtc,
  updatedAt:    Schema.NullOr(Schema.DateTimeUtc),
})
export type Client = Schema.Schema.Type<typeof Client>

export const CreateClientInput = Schema.Struct({
  name:          Schema.String,
  client_id:     Schema.String,
  client_secret: Schema.optional(Schema.String),
  redirect_uris: Schema.Array(Schema.String),
  scopes:        Schema.Array(Schema.String),
  grant_types:   Schema.Array(Schema.String),
  is_public:     Schema.Boolean,
})
export type CreateClientInput = Schema.Schema.Type<typeof CreateClientInput>

export const UpdateClientInput = Schema.Struct({
  name:          Schema.optional(Schema.String),
  redirect_uris: Schema.optional(Schema.Array(Schema.String)),
  scopes:        Schema.optional(Schema.Array(Schema.String)),
  grant_types:   Schema.optional(Schema.Array(Schema.String)),
})
export type UpdateClientInput = Schema.Schema.Type<typeof UpdateClientInput>

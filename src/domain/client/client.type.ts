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

export class CreateClientInput extends Schema.Class<CreateClientInput>("CreateClientInput")({
  name:         Schema.String,
  clientId:     Schema.String,
  clientSecret: Schema.optional(Schema.String),
  redirectUris: Schema.Array(Schema.String),
  scopes:       Schema.Array(Schema.String),
  grantTypes:   Schema.Array(Schema.String),
  isPublic:     Schema.Boolean,
}) {}

export class UpdateClientInput extends Schema.Class<UpdateClientInput>("UpdateClientInput")({
  name:         Schema.optional(Schema.String),
  redirectUris: Schema.optional(Schema.Array(Schema.String)),
  scopes:       Schema.optional(Schema.Array(Schema.String)),
  grantTypes:   Schema.optional(Schema.Array(Schema.String)),
}) {}

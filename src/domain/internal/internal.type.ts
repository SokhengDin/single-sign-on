import { Schema } from "effect"

export const ProviderConfirmBody = Schema.Struct({
  qr_token:    Schema.String,
  client_id:   Schema.String,
  provider_id: Schema.String,
  username:    Schema.optional(Schema.String),
  first_name:  Schema.optional(Schema.String),
  last_name:   Schema.optional(Schema.String),
})
export type ProviderConfirmBody = Schema.Schema.Type<typeof ProviderConfirmBody>

export const ProviderConfirmResponse = Schema.Struct({
  external_system: Schema.String,
})
export type ProviderConfirmResponse = Schema.Schema.Type<typeof ProviderConfirmResponse>

import { Schema } from "effect"

export const GenerateKeyInput = Schema.Struct({
  algorithm: Schema.optional(Schema.String),
})
export type GenerateKeyInput = Schema.Schema.Type<typeof GenerateKeyInput>

export const KeyResponse = Schema.Struct({
  kid:       Schema.String,
  algorithm: Schema.String,
  is_active: Schema.Boolean,
})
export type KeyResponse = Schema.Schema.Type<typeof KeyResponse>

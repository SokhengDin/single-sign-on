import { Schema } from "effect"

export const VerificationSendInput = Schema.Struct({
  identifier: Schema.String,
  metadata:   Schema.optional(Schema.Unknown),
})
export type VerificationSendInput = Schema.Schema.Type<typeof VerificationSendInput>

export const VerificationConsumeInput = Schema.Struct({
  value: Schema.String,
})
export type VerificationConsumeInput = Schema.Schema.Type<typeof VerificationConsumeInput>

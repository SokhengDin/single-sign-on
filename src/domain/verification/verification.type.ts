import { Schema } from "effect"

export class VerificationSendInput extends Schema.Class<VerificationSendInput>("VerificationSendInput")({
  identifier: Schema.String,
  metadata:   Schema.optional(Schema.Unknown),
}) {}

export class VerificationConsumeInput extends Schema.Class<VerificationConsumeInput>("VerificationConsumeInput")({
  value: Schema.String,
}) {}

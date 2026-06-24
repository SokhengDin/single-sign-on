import { Schema } from "effect"

export class NoActiveSigningKeyError extends Schema.TaggedErrorClass<NoActiveSigningKeyError>()("NoActiveSigningKeyError", {}) {}

export class SigningKeyNotFoundError extends Schema.TaggedErrorClass<SigningKeyNotFoundError>()("SigningKeyNotFoundError", {
  kid: Schema.String,
}) {}

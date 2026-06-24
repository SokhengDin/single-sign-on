import { Schema } from "effect"

export class TokenNotFoundError extends Schema.TaggedErrorClass<TokenNotFoundError>()("TokenNotFoundError", {}, { httpApiStatus: 404 }) {}

export class TokenExpiredError extends Schema.TaggedErrorClass<TokenExpiredError>()("TokenExpiredError", {}, { httpApiStatus: 401 }) {}

export class TokenRevokedError extends Schema.TaggedErrorClass<TokenRevokedError>()("TokenRevokedError", {}, { httpApiStatus: 401 }) {}

export class InvalidGrantError extends Schema.TaggedErrorClass<InvalidGrantError>()("InvalidGrantError", {
  reason: Schema.String,
}, { httpApiStatus: 400 }) {}

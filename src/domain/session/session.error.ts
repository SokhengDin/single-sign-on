import { Schema } from "effect"

export class SessionNotFoundError extends Schema.TaggedErrorClass<SessionNotFoundError>()("SessionNotFoundError", {
  sessionId: Schema.String,
}) {}

export class SessionExpiredError extends Schema.TaggedErrorClass<SessionExpiredError>()("SessionExpiredError", {}) {}

export class SessionRevokedError extends Schema.TaggedErrorClass<SessionRevokedError>()("SessionRevokedError", {}) {}

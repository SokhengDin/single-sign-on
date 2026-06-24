import { Schema } from "effect"

export class UserNotFoundError extends Schema.TaggedErrorClass<UserNotFoundError>()("UserNotFoundError", {
  userId: Schema.String,
}, { httpApiStatus: 404 }) {}

export class UserAlreadyDeletedError extends Schema.TaggedErrorClass<UserAlreadyDeletedError>()("UserAlreadyDeletedError", {
  userId: Schema.String,
}, { httpApiStatus: 409 }) {}

export class LinkedAccountNotFoundError extends Schema.TaggedErrorClass<LinkedAccountNotFoundError>()("LinkedAccountNotFoundError", {
  userId:         Schema.String,
  externalSystem: Schema.String,
}, { httpApiStatus: 404 }) {}

export class LinkedAccountConflictError extends Schema.TaggedErrorClass<LinkedAccountConflictError>()("LinkedAccountConflictError", {
  userId:         Schema.String,
  externalSystem: Schema.String,
}, { httpApiStatus: 409 }) {}

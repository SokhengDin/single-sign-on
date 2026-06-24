import { Schema } from "effect"

export class AuthCodeNotFoundError extends Schema.TaggedErrorClass<AuthCodeNotFoundError>()("AuthCodeNotFoundError", {
  code: Schema.String,
}, { httpApiStatus: 404 }) {}

export class AuthCodeExpiredError extends Schema.TaggedErrorClass<AuthCodeExpiredError>()("AuthCodeExpiredError", {}, { httpApiStatus: 400 }) {}

export class AuthCodeAlreadyUsedError extends Schema.TaggedErrorClass<AuthCodeAlreadyUsedError>()("AuthCodeAlreadyUsedError", {}, { httpApiStatus: 400 }) {}

export class PKCEVerifyError extends Schema.TaggedErrorClass<PKCEVerifyError>()("PKCEVerifyError", {}, { httpApiStatus: 400 }) {}

export class RedirectMismatchError extends Schema.TaggedErrorClass<RedirectMismatchError>()("RedirectMismatchError", {
  redirectUri: Schema.String,
}, { httpApiStatus: 400 }) {}

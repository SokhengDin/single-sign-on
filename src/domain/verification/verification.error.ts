import { Schema } from "effect"

export class VerificationNotFoundError extends Schema.TaggedErrorClass<VerificationNotFoundError>()("VerificationNotFoundError", {}, { httpApiStatus: 404 }) {}

export class VerificationExpiredError extends Schema.TaggedErrorClass<VerificationExpiredError>()("VerificationExpiredError", {}, { httpApiStatus: 400 }) {}

export class VerificationAlreadyUsedError extends Schema.TaggedErrorClass<VerificationAlreadyUsedError>()("VerificationAlreadyUsedError", {}, { httpApiStatus: 400 }) {}

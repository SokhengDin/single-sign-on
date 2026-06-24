import { Schema } from "effect"

export class AccountNotFoundError extends Schema.TaggedErrorClass<AccountNotFoundError>()("AccountNotFoundError", {
  provider:   Schema.String,
  providerId: Schema.String,
}, { httpApiStatus: 404 }) {}

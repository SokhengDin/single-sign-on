import { Schema } from "effect"

export class ClientNotFoundError extends Schema.TaggedErrorClass<ClientNotFoundError>()("ClientNotFoundError", {
  clientId: Schema.String,
}, { httpApiStatus: 404 }) {}

export class ClientInactiveError extends Schema.TaggedErrorClass<ClientInactiveError>()("ClientInactiveError", {
  clientId: Schema.String,
}, { httpApiStatus: 400 }) {}

export class InvalidRedirectUriError extends Schema.TaggedErrorClass<InvalidRedirectUriError>()("InvalidRedirectUriError", {
  redirectUri: Schema.String,
}, { httpApiStatus: 400 }) {}

export class InvalidClientSecretError extends Schema.TaggedErrorClass<InvalidClientSecretError>()("InvalidClientSecretError", {}, { httpApiStatus: 401 }) {}

import { Context, Effect, Layer } from "effect"
import { SqlError } from "effect/unstable/sql"
import { CryptoService } from "@/infra/crypto.ts"
import {
  ClientInactiveError,
  ClientNotFoundError,
  InvalidClientSecretError,
  InvalidRedirectUriError,
} from "./client.error.ts"
import { Client, CreateClientInput, UpdateClientInput } from "./client.type.ts"
import { ClientRepo } from "./client.sql.ts"

export class ClientService extends Context.Service<ClientService, {
  create(input: CreateClientInput): Effect.Effect<Client, SqlError.SqlError>

  findById(id: string): Effect.Effect<Client, ClientNotFoundError | SqlError.SqlError>

  findByClientId(clientId: string): Effect.Effect<Client, ClientNotFoundError | SqlError.SqlError>

  validateClient(
    clientId: string,
    clientSecret: string | undefined,
    redirectUri: string
  ): Effect.Effect<Client, ClientNotFoundError | ClientInactiveError | InvalidRedirectUriError | InvalidClientSecretError | SqlError.SqlError>

  verifyCredentials(
    clientId: string,
    clientSecret: string
  ): Effect.Effect<Client, ClientNotFoundError | InvalidClientSecretError | SqlError.SqlError>

  update(id: string, input: UpdateClientInput): Effect.Effect<Client, ClientNotFoundError | SqlError.SqlError>

  deactivate(id: string): Effect.Effect<void, ClientNotFoundError | SqlError.SqlError>
}>()("sso/domain/ClientService") {
  static readonly layer = Layer.effect(
    ClientService,
    Effect.gen(function* () {
      const repo   = yield* ClientRepo
      const crypto = yield* CryptoService

      const create = Effect.fn("ClientService.create")(function* (
        input: CreateClientInput
      ): Effect.fn.Return<Client, SqlError.SqlError> {
        const uris 				= input.redirect_uris ?? []
        const secretHash 	= input.client_secret
          ? yield* crypto.sha256(input.client_secret)
          : null
        return yield* repo.insert(
          input.name,
          input.type,
          input.client_id,
          secretHash,
          uris,
          input.scopes,
          input.grant_types,
          input.is_public
        )
      })

      const findById = Effect.fn("ClientService.findById")(function* (
        id: string
      ): Effect.fn.Return<Client, ClientNotFoundError | SqlError.SqlError> {
        const client = yield* repo.findById(id)
        if (!client) return yield* new ClientNotFoundError({ clientId: id })
        return client
      })

      const findByClientId = Effect.fn("ClientService.findByClientId")(function* (
        clientId: string
      ): Effect.fn.Return<Client, ClientNotFoundError | SqlError.SqlError> {
        const client = yield* repo.findByClientId(clientId)
        if (!client) return yield* new ClientNotFoundError({ clientId })
        return client
      })

      const validateClient = Effect.fn("ClientService.validateClient")(function* (
        clientId: string,
        clientSecret: string | undefined,
        redirectUri: string
      ): Effect.fn.Return<Client, ClientNotFoundError | ClientInactiveError | InvalidRedirectUriError | InvalidClientSecretError | SqlError.SqlError> {
        const client = yield* findByClientId(clientId)
        if (!client.is_active) return yield* new ClientInactiveError({ clientId })
        if (!client.redirect_uris.includes(redirectUri)) {
          return yield* new InvalidRedirectUriError({ redirectUri })
        }
        if (clientSecret !== undefined) {
          if (!client.is_public) {
            const hash = yield* crypto.sha256(clientSecret)
            const rows = yield* repo.findByClientId(clientId)
            if ((rows as unknown as { client_secret?: string })?.client_secret !== hash) {
              return yield* new InvalidClientSecretError()
            }
          }
        }
        return client
      })

      const update = Effect.fn("ClientService.update")(function* (
        id: 		string,
        input: 	UpdateClientInput
      ): Effect.fn.Return<Client, ClientNotFoundError | SqlError.SqlError> {

        const existing = yield* repo.findById(id)

        if (!existing) return yield* new ClientNotFoundError({ clientId: id })

        const updated = yield* repo.update(id, input.name, input.type, input.redirect_uris, input.scopes, input.grant_types)

        if (!updated) return yield* new ClientNotFoundError({ clientId: id })
        return updated
      })

      const deactivate = Effect.fn("ClientService.deactivate")(function* (
        id: string
      ): Effect.fn.Return<void, ClientNotFoundError | SqlError.SqlError> {
        const client = yield* repo.findById(id)
        if (!client) return yield* new ClientNotFoundError({ clientId: id })
        yield* repo.deactivate(id)
      })

      const verifyCredentials = Effect.fn("ClientService.verifyCredentials")(function* (
        clientId: string,
        clientSecret: string
      ): Effect.fn.Return<Client, ClientNotFoundError | InvalidClientSecretError | SqlError.SqlError> {
        const client     = yield* findByClientId(clientId)
        const secretHash = yield* repo.findSecretHash(clientId)
        const hash       = yield* crypto.sha256(clientSecret)
        if (secretHash !== hash) return yield* new InvalidClientSecretError()
        return client
      })

      return ClientService.of({ create, findById, findByClientId, validateClient, verifyCredentials, update, deactivate })
    })
  ).pipe(Layer.provide(ClientRepo.layer))
}

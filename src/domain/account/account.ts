import { Context, Effect, Layer } from "effect"
import { SqlClient, SqlError } from "effect/unstable/sql"
import { AccountNotFoundError } from "./account.error.ts"
import { Account, UpsertAccountInput } from "./account.type.ts"
import { AccountRepo } from "./account.sql.ts"

export class AccountService extends Context.Service<AccountService, {
  upsert(input: UpsertAccountInput): Effect.Effect<Account, SqlError.SqlError>
  findByProvider(provider: string, providerId: string): Effect.Effect<Account, AccountNotFoundError | SqlError.SqlError>
  findAllByUser(userId: string): Effect.Effect<ReadonlyArray<Account>, SqlError.SqlError>
}>()("sso/domain/AccountService") {
  static readonly layer = Layer.effect(
    AccountService,
    Effect.gen(function* () {
      const repo = yield* AccountRepo
      const sql  = yield* SqlClient.SqlClient

      const upsert = Effect.fn("AccountService.upsert")(function* (
        input: UpsertAccountInput
      ): Effect.fn.Return<Account, SqlError.SqlError> {
        return yield* sql.withTransaction(Effect.gen(function* () {
          let userId = input.user_id

          if (!userId) {
            const rows = yield* sql<{ id: string }>`
              INSERT INTO "user" (display_name, avatar_url)
              VALUES (${input.display_name ?? null}, ${input.avatar_url ?? null})
              RETURNING id
            `
            userId = rows[0]!.id
          }

          return yield* repo.upsert(userId, input.provider, input.provider_id, input.payload ?? {}, input.scope ?? [])
        }))
      })

      const findByProvider = Effect.fn("AccountService.findByProvider")(function* (
        provider: string,
        providerId: string
      ): Effect.fn.Return<Account, AccountNotFoundError | SqlError.SqlError> {
        const account = yield* repo.findByProvider(provider, providerId)
        if (!account) return yield* new AccountNotFoundError({ provider, providerId })
        return account
      })

      const findAllByUser = Effect.fn("AccountService.findAllByUser")(function* (
        userId: string
      ): Effect.fn.Return<ReadonlyArray<Account>, SqlError.SqlError> {
        return yield* repo.findAllByUser(userId)
      })

      return AccountService.of({ upsert, findByProvider, findAllByUser })
    })
  ).pipe(Layer.provide(AccountRepo.layer))
}

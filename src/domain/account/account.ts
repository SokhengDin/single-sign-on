import { Context, Effect, Layer } from "effect"
import { SqlError } from "effect/unstable/sql"
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

      const upsert = Effect.fn("AccountService.upsert")(function* (
        input: UpsertAccountInput
      ): Effect.fn.Return<Account, SqlError.SqlError> {
        return yield* repo.upsert(input.userId, input.provider, input.providerId, input.payload, input.scope)
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

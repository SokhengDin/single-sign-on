import { Context, DateTime, Effect, Layer } from "effect"
import { SqlClient, SqlError } from "effect/unstable/sql"
import { Account } from "./account.type.ts"

type AccountRow = {
  id:          string
  user_id:     string
  provider:    string
  provider_id: string
  payload:     unknown
  scope:       string[]
  created_at:  Date
  updated_at:  Date | null
}

const toAccount = (row: AccountRow): Account => ({
  id:          row.id,
  user_id:     row.user_id,
  provider:    row.provider,
  provider_id: row.provider_id,
  payload:     row.payload,
  scope:       row.scope,
  created_at:  DateTime.fromDateUnsafe(row.created_at),
  updated_at:  row.updated_at ? DateTime.fromDateUnsafe(row.updated_at) : null,
})

export class AccountRepo extends Context.Service<AccountRepo, {
  upsert(userId: string, provider: string, providerId: string, payload: unknown, scope: readonly string[]): Effect.Effect<Account, SqlError.SqlError>
  findByProvider(provider: string, providerId: string): Effect.Effect<Account | null, SqlError.SqlError>
  findAllByUser(userId: string): Effect.Effect<ReadonlyArray<Account>, SqlError.SqlError>
}>()("sso/domain/AccountRepo") {
  static readonly layer = Layer.effect(
    AccountRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const upsert = Effect.fn("AccountRepo.upsert")(function* (
        userId: string,
        provider: string,
        providerId: string,
        payload: unknown,
        scope: readonly string[]
      ) {
        const rows = yield* sql<AccountRow>`
          INSERT INTO account (user_id, provider, provider_id, payload, scope)
          VALUES (${userId}, ${provider}, ${providerId}, ${JSON.stringify(payload)}, ${scope})
          ON CONFLICT (provider, provider_id) DO UPDATE
            SET payload    = EXCLUDED.payload,
                scope      = EXCLUDED.scope,
                updated_at = now()
          RETURNING *
        `
        return toAccount(rows[0]!)
      })

      const findByProvider = Effect.fn("AccountRepo.findByProvider")(function* (
        provider: string,
        providerId: string
      ) {
        const rows = yield* sql<AccountRow>`
          SELECT * FROM account
          WHERE provider = ${provider} AND provider_id = ${providerId}
        `
        return rows[0] ? toAccount(rows[0]) : null
      })

      const findAllByUser = Effect.fn("AccountRepo.findAllByUser")(function* (userId: string) {
        const rows = yield* sql<AccountRow>`
          SELECT * FROM account WHERE user_id = ${userId} ORDER BY created_at ASC
        `
        return rows.map(toAccount)
      })

      return AccountRepo.of({ upsert, findByProvider, findAllByUser })
    })
  )
}

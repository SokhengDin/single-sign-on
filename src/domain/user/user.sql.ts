import { Context, DateTime, Effect, Layer } from "effect"
import { SqlClient, SqlError } from "effect/unstable/sql"
import { LinkedAccount, User } from "./user.type.ts"

type UserRow = {
  id:           string
  display_name: string | null
  avatar_url:   string | null
  is_active:    boolean
  created_at:   Date
  updated_at:   Date | null
  deleted_at:   Date | null
}

type LinkedAccountRow = {
  id:               string
  user_id:          string
  external_user_id: string
  external_system:  string
  scope:            string[]
  linked_at:        Date
  unlinked_at:      Date | null
}

const toUser = (row: UserRow): User => ({
  id:           row.id,
  display_name: row.display_name,
  avatar_url:   row.avatar_url,
  is_active:    row.is_active,
  created_at:   DateTime.fromDateUnsafe(row.created_at),
  updated_at:   row.updated_at ? DateTime.fromDateUnsafe(row.updated_at) : null,
  deleted_at:   row.deleted_at ? DateTime.fromDateUnsafe(row.deleted_at) : null,
})

const toLinkedAccount = (row: LinkedAccountRow): LinkedAccount => ({
  id:               row.id,
  user_id:          row.user_id,
  external_user_id: row.external_user_id,
  external_system:  row.external_system,
  scope:            row.scope,
  linked_at:        DateTime.fromDateUnsafe(row.linked_at),
  unlinked_at:      row.unlinked_at ? DateTime.fromDateUnsafe(row.unlinked_at) : null,
})

export class UserRepo extends Context.Service<UserRepo, {
  insert(displayName: string | null, avatarUrl: string | null): Effect.Effect<User, SqlError.SqlError>
  findById(userId: string): Effect.Effect<User | null, SqlError.SqlError>
  updateById(userId: string, displayName: string | null | undefined, avatarUrl: string | null | undefined): Effect.Effect<User | null, SqlError.SqlError>
  softDeleteById(userId: string): Effect.Effect<void, SqlError.SqlError>
  insertLinkedAccount(userId: string, externalUserId: string, externalSystem: string, scope: readonly string[]): Effect.Effect<LinkedAccount, SqlError.SqlError>
  unlinkAccount(userId: string, externalSystem: string): Effect.Effect<boolean, SqlError.SqlError>
  findLinkedAccountActive(userId: string, externalSystem: string): Effect.Effect<LinkedAccount | null, SqlError.SqlError>
  findAllLinkedAccounts(userId: string): Effect.Effect<ReadonlyArray<LinkedAccount>, SqlError.SqlError>
}>()("sso/domain/UserRepo") {
  static readonly layer = Layer.effect(
    UserRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const insert = Effect.fn("UserRepo.insert")(function* (
        displayName: string | null,
        avatarUrl: string | null
      ) {
        const rows = yield* sql<UserRow>`
          INSERT INTO "user" (display_name, avatar_url)
          VALUES (${displayName}, ${avatarUrl})
          RETURNING *
        `
        return toUser(rows[0]!)
      })

      const findById = Effect.fn("UserRepo.findById")(function* (userId: string) {
        const rows = yield* sql<UserRow>`
          SELECT * FROM "user" WHERE id = ${userId}
        `
        return rows[0] ? toUser(rows[0]) : null
      })

      const updateById = Effect.fn("UserRepo.updateById")(function* (
        userId: string,
        displayName: string | null | undefined,
        avatarUrl: string | null | undefined
      ) {
        const rows = yield* sql<UserRow>`
          UPDATE "user"
          SET
            display_name = COALESCE(${displayName ?? null}, display_name),
            avatar_url   = COALESCE(${avatarUrl ?? null}, avatar_url),
            updated_at   = now()
          WHERE id = ${userId}
          RETURNING *
        `
        return rows[0] ? toUser(rows[0]) : null
      })

      const softDeleteById = Effect.fn("UserRepo.softDeleteById")(function* (userId: string) {
        yield* sql`
          UPDATE "user"
          SET deleted_at = now(), is_active = false, updated_at = now()
          WHERE id = ${userId}
        `
      })

      const insertLinkedAccount = Effect.fn("UserRepo.insertLinkedAccount")(function* (
        userId: string,
        externalUserId: string,
        externalSystem: string,
        scope: readonly string[]
      ) {
        const rows = yield* sql<LinkedAccountRow>`
          INSERT INTO linked_account (user_id, external_user_id, external_system, scope)
          VALUES (${userId}, ${externalUserId}, ${externalSystem}, ${scope})
          RETURNING *
        `
        return toLinkedAccount(rows[0]!)
      })

      const unlinkAccount = Effect.fn("UserRepo.unlinkAccount")(function* (userId: string, externalSystem: string) {
        const rows = yield* sql<{ id: string }>`
          UPDATE linked_account
          SET unlinked_at = now()
          WHERE user_id = ${userId}
            AND external_system = ${externalSystem}
            AND unlinked_at IS NULL
          RETURNING id
        `
        return rows.length > 0
      })

      const findLinkedAccountActive = Effect.fn("UserRepo.findLinkedAccountActive")(function* (
        userId: string,
        externalSystem: string
      ) {
        const rows = yield* sql<LinkedAccountRow>`
          SELECT * FROM linked_account
          WHERE user_id = ${userId}
            AND external_system = ${externalSystem}
            AND unlinked_at IS NULL
        `
        return rows[0] ? toLinkedAccount(rows[0]) : null
      })

      const findAllLinkedAccounts = Effect.fn("UserRepo.findAllLinkedAccounts")(function* (userId: string) {
        const rows = yield* sql<LinkedAccountRow>`
          SELECT * FROM linked_account
          WHERE user_id = ${userId}
          ORDER BY linked_at DESC
        `
        return rows.map(toLinkedAccount)
      })

      return UserRepo.of({
        insert,
        findById,
        updateById,
        softDeleteById,
        insertLinkedAccount,
        unlinkAccount,
        findLinkedAccountActive,
        findAllLinkedAccounts,
      })
    })
  )
}

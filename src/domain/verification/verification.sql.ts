import { Context, DateTime, Effect, Layer } from "effect"
import { SqlClient, SqlError } from "effect/unstable/sql"

export type Verification = {
  id:         string
  identifier: string
  value:      string
  metadata:   unknown
  expiresAt:  DateTime.Utc
  usedAt:     DateTime.Utc | null
  createdAt:  DateTime.Utc
}

type VerificationRow = {
  id:         string
  identifier: string
  value:      string
  metadata:   unknown
  expires_at: Date
  used_at:    Date | null
  created_at: Date
}

const toVerification = (row: VerificationRow): Verification => ({
  id:         row.id,
  identifier: row.identifier,
  value:      row.value,
  metadata:   row.metadata,
  expiresAt:  DateTime.fromDateUnsafe(row.expires_at),
  usedAt:     row.used_at ? DateTime.fromDateUnsafe(row.used_at) : null,
  createdAt:  DateTime.fromDateUnsafe(row.created_at),
})

export class VerificationRepo extends Context.Service<VerificationRepo, {
  insert(identifier: string, value: string, metadata: unknown, expiresAt: Date): Effect.Effect<Verification, SqlError.SqlError>
  findByValue(value: string): Effect.Effect<Verification | null, SqlError.SqlError>
  markUsed(id: string): Effect.Effect<void, SqlError.SqlError>
}>()("sso/domain/VerificationRepo") {
  static readonly layer = Layer.effect(
    VerificationRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const insert = Effect.fn("VerificationRepo.insert")(function* (
        identifier: string,
        value: string,
        metadata: unknown,
        expiresAt: Date
      ) {
        const rows = yield* sql<VerificationRow>`
          INSERT INTO verification (identifier, value, metadata, expires_at)
          VALUES (${identifier}, ${value}, ${JSON.stringify(metadata)}, ${expiresAt})
          RETURNING *
        `
        return toVerification(rows[0]!)
      })

      const findByValue = Effect.fn("VerificationRepo.findByValue")(function* (value: string) {
        const rows = yield* sql<VerificationRow>`
          SELECT * FROM verification WHERE value = ${value}
        `
        return rows[0] ? toVerification(rows[0]) : null
      })

      const markUsed = Effect.fn("VerificationRepo.markUsed")(function* (id: string) {
        yield* sql`
          UPDATE verification SET used_at = now() WHERE id = ${id}
        `
      })

      return VerificationRepo.of({ insert, findByValue, markUsed })
    })
  )
}

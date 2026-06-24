import { Context, DateTime, Effect, Layer } from "effect"
import { SqlClient, SqlError } from "effect/unstable/sql"

export type Session = {
  id:        string
  userId:    string
  clientId:  string
  tokenId:   string
  ipAddress: string | null
  userAgent: string | null
  expiresAt: DateTime.Utc
  revokedAt: DateTime.Utc | null
  createdAt: DateTime.Utc
}

type SessionRow = {
  id:         string
  user_id:    string
  client_id:  string
  token_id:   string
  ip_address: string | null
  user_agent: string | null
  expires_at: Date
  revoked_at: Date | null
  created_at: Date
}

const toSession = (row: SessionRow): Session => ({
  id:        row.id,
  userId:    row.user_id,
  clientId:  row.client_id,
  tokenId:   row.token_id,
  ipAddress: row.ip_address,
  userAgent: row.user_agent,
  expiresAt: DateTime.fromDateUnsafe(row.expires_at),
  revokedAt: row.revoked_at ? DateTime.fromDateUnsafe(row.revoked_at) : null,
  createdAt: DateTime.fromDateUnsafe(row.created_at),
})

export class SessionRepo extends Context.Service<SessionRepo, {
  insert(
    userId: string,
    clientId: string,
    tokenId: string,
    expiresAt: Date,
    ipAddress: string | null,
    userAgent: string | null
  ): Effect.Effect<Session, SqlError.SqlError>
  findById(sessionId: string): Effect.Effect<Session | null, SqlError.SqlError>
  revoke(sessionId: string): Effect.Effect<void, SqlError.SqlError>
  findActiveByUser(userId: string, clientId: string): Effect.Effect<ReadonlyArray<Session>, SqlError.SqlError>
}>()("sso/domain/SessionRepo") {
  static readonly layer = Layer.effect(
    SessionRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const insert = Effect.fn("SessionRepo.insert")(function* (
        userId: string,
        clientId: string,
        tokenId: string,
        expiresAt: Date,
        ipAddress: string | null,
        userAgent: string | null
      ) {
        const rows = yield* sql<SessionRow>`
          INSERT INTO session (user_id, client_id, token_id, expires_at, ip_address, user_agent)
          VALUES (${userId}, ${clientId}, ${tokenId}, ${expiresAt}, ${ipAddress}, ${userAgent})
          RETURNING *
        `
        return toSession(rows[0]!)
      })

      const findById = Effect.fn("SessionRepo.findById")(function* (sessionId: string) {
        const rows = yield* sql<SessionRow>`
          SELECT * FROM session WHERE id = ${sessionId}
        `
        return rows[0] ? toSession(rows[0]) : null
      })

      const revoke = Effect.fn("SessionRepo.revoke")(function* (sessionId: string) {
        yield* sql`
          UPDATE session SET revoked_at = now() WHERE id = ${sessionId}
        `
      })

      const findActiveByUser = Effect.fn("SessionRepo.findActiveByUser")(function* (
        userId: string,
        clientId: string
      ) {
        const rows = yield* sql<SessionRow>`
          SELECT * FROM session
          WHERE user_id = ${userId}
            AND client_id = ${clientId}
            AND revoked_at IS NULL
            AND expires_at > now()
          ORDER BY created_at DESC
        `
        return rows.map(toSession)
      })

      return SessionRepo.of({ insert, findById, revoke, findActiveByUser })
    })
  )
}

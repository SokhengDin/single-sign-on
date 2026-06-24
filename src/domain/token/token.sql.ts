import { Context, DateTime, Effect, Layer } from "effect"
import { SqlClient, SqlError } from "effect/unstable/sql"

export type Token = {
  id:        string
  userId:    string
  clientId:  string
  type:      "access" | "refresh"
  tokenHash: string
  lastFour:  string | null
  scopes:    string[]
  ipAddress: string | null
  userAgent: string | null
  expiresAt: DateTime.Utc | null
  revokedAt: DateTime.Utc | null
  createdAt: DateTime.Utc
}

type TokenRow = {
  id:         string
  user_id:    string
  client_id:  string
  type:       "access" | "refresh"
  token_hash: string
  last_four:  string | null
  scopes:     string[]
  ip_address: string | null
  user_agent: string | null
  expires_at: Date | null
  revoked_at: Date | null
  created_at: Date
}

const toToken = (row: TokenRow): Token => ({
  id:        row.id,
  userId:    row.user_id,
  clientId:  row.client_id,
  type:      row.type,
  tokenHash: row.token_hash,
  lastFour:  row.last_four,
  scopes:    row.scopes,
  ipAddress: row.ip_address,
  userAgent: row.user_agent,
  expiresAt: row.expires_at ? DateTime.fromDateUnsafe(row.expires_at) : null,
  revokedAt: row.revoked_at ? DateTime.fromDateUnsafe(row.revoked_at) : null,
  createdAt: DateTime.fromDateUnsafe(row.created_at),
})

export class TokenRepo extends Context.Service<TokenRepo, {
  insert(
    userId: string,
    clientId: string,
    type: "access" | "refresh",
    tokenHash: string,
    lastFour: string,
    scopes: readonly string[],
    expiresAt: Date | null,
    ipAddress: string | null,
    userAgent: string | null
  ): Effect.Effect<Token, SqlError.SqlError>
  findByHash(tokenHash: string): Effect.Effect<Token | null, SqlError.SqlError>
  revoke(id: string): Effect.Effect<void, SqlError.SqlError>
  revokeAllForUser(userId: string, clientId: string): Effect.Effect<void, SqlError.SqlError>
}>()("sso/domain/TokenRepo") {
  static readonly layer = Layer.effect(
    TokenRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const insert = Effect.fn("TokenRepo.insert")(function* (
        userId: string,
        clientId: string,
        type: "access" | "refresh",
        tokenHash: string,
        lastFour: string,
        scopes: readonly string[],
        expiresAt: Date | null,
        ipAddress: string | null,
        userAgent: string | null
      ) {
        const rows = yield* sql<TokenRow>`
          INSERT INTO token (user_id, client_id, type, token_hash, last_four, scopes, expires_at, ip_address, user_agent)
          VALUES (${userId}, ${clientId}, ${type}, ${tokenHash}, ${lastFour}, ${scopes}, ${expiresAt}, ${ipAddress}, ${userAgent})
          RETURNING *
        `
        return toToken(rows[0]!)
      })

      const findByHash = Effect.fn("TokenRepo.findByHash")(function* (tokenHash: string) {
        const rows = yield* sql<TokenRow>`
          SELECT * FROM token WHERE token_hash = ${tokenHash}
        `
        return rows[0] ? toToken(rows[0]) : null
      })

      const revoke = Effect.fn("TokenRepo.revoke")(function* (id: string) {
        yield* sql`
          UPDATE token SET revoked_at = now() WHERE id = ${id}
        `
      })

      const revokeAllForUser = Effect.fn("TokenRepo.revokeAllForUser")(function* (userId: string, clientId: string) {
        yield* sql`
          UPDATE token
          SET revoked_at = now()
          WHERE user_id = ${userId} AND client_id = ${clientId} AND revoked_at IS NULL
        `
      })

      return TokenRepo.of({ insert, findByHash, revoke, revokeAllForUser })
    })
  )
}

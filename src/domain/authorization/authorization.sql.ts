import { Context, DateTime, Effect, Layer } from "effect"
import { SqlClient, SqlError } from "effect/unstable/sql"

export type AuthCode = {
  id:              string
  code:            string
  userId:          string
  clientId:        string
  redirectUri:     string
  scopes:          string[]
  codeChallenge:   string | null
  challengeMethod: string | null
  nonce:           string | null
  authTime:        DateTime.Utc
  expiresAt:       DateTime.Utc
  usedAt:          DateTime.Utc | null
  createdAt:       DateTime.Utc
}

type AuthCodeRow = {
  id:               string
  code:             string
  user_id:          string
  client_id:        string
  redirect_uri:     string
  scopes:           string[]
  code_challenge:   string | null
  challenge_method: string | null
  nonce:            string | null
  auth_time:        Date
  expires_at:       Date
  used_at:          Date | null
  created_at:       Date
}

const toAuthCode = (row: AuthCodeRow): AuthCode => ({
  id:              row.id,
  code:            row.code,
  userId:          row.user_id,
  clientId:        row.client_id,
  redirectUri:     row.redirect_uri,
  scopes:          row.scopes,
  codeChallenge:   row.code_challenge,
  challengeMethod: row.challenge_method,
  nonce:           row.nonce,
  authTime:        DateTime.fromDateUnsafe(row.auth_time),
  expiresAt:       DateTime.fromDateUnsafe(row.expires_at),
  usedAt:          row.used_at ? DateTime.fromDateUnsafe(row.used_at) : null,
  createdAt:       DateTime.fromDateUnsafe(row.created_at),
})

export class AuthorizationRepo extends Context.Service<AuthorizationRepo, {
  insert(
    code: 		string,
    userId: 	string,
    clientId: string,
    redirectUri: 	string,
    scopes: 			readonly string[],
    codeChallenge: 		string | null,
    challengeMethod: 	string | null,
    nonce:		 string | null,
    expiresAt: Date
  ): Effect.Effect<AuthCode, SqlError.SqlError>
  findByCode(code: string): Effect.Effect<AuthCode | null, SqlError.SqlError>
  markUsed(id: string): Effect.Effect<void, SqlError.SqlError>
}>()("sso/domain/AuthorizationRepo") {
  static readonly layer = Layer.effect(
    AuthorizationRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const insert = Effect.fn("AuthorizationRepo.insert")(function* (
        code: 		string,
        userId: 	string,
        clientId: string,
        redirectUri: 			string,
        scopes: 					readonly string[],
        codeChallenge: 		string | null,
        challengeMethod: 	string | null,
        nonce: 			string | null,
        expiresAt: 	Date
      ) {
        const rows = yield* sql<AuthCodeRow>`
          INSERT INTO authorization_code
            (code, user_id, client_id, redirect_uri, scopes, code_challenge, challenge_method, nonce, expires_at)
          VALUES
            (${code}, ${userId}, ${clientId}, ${redirectUri}, ${scopes},
             ${codeChallenge}, ${challengeMethod}, ${nonce}, ${expiresAt})
          RETURNING *
        `
        return toAuthCode(rows[0]!)
      })

      const findByCode = Effect.fn("AuthorizationRepo.findByCode")(function* (code: string) {
        const rows = yield* sql<AuthCodeRow>`
          SELECT * FROM authorization_code WHERE code = ${code}
        `
        return rows[0] ? toAuthCode(rows[0]) : null
      })

      const markUsed = Effect.fn("AuthorizationRepo.markUsed")(function* (id: string) {
        yield* sql`
          UPDATE authorization_code SET used_at = now() WHERE id = ${id}
        `
      })

      return AuthorizationRepo.of({ insert, findByCode, markUsed })
    })
  )
}

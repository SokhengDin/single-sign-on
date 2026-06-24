import { Context, DateTime, Effect, Layer } from "effect"
import { SqlClient, SqlError } from "effect/unstable/sql"
import { CryptoService } from "@/infra/crypto.ts"
import { SessionRepo } from "@/domain/session/session.sql.ts"
import { TokenNotFoundError, TokenExpiredError, TokenRevokedError } from "./token.error.ts"
import { type Token, TokenRepo } from "./token.sql.ts"

export type IssuedTokenPair = {
  accessToken:  string
  refreshToken: string
  accessRecord: Token
}

export class TokenService extends Context.Service<TokenService, {
  issueTokenPair(
    userId: string,
    clientId: string,
    scopes: readonly string[],
    ipAddress: string | null,
    userAgent: string | null
  ): Effect.Effect<IssuedTokenPair, SqlError.SqlError>
  validateAccessToken(raw: string): Effect.Effect<Token, TokenNotFoundError | TokenExpiredError | TokenRevokedError | SqlError.SqlError>
  revokeToken(raw: string): Effect.Effect<void, TokenNotFoundError | SqlError.SqlError>
  revokeAllForUser(userId: string, clientId: string): Effect.Effect<void, SqlError.SqlError>
}>()("sso/domain/TokenService") {
  static readonly layer = Layer.effect(
    TokenService,
    Effect.gen(function* () {
      const sql        = yield* SqlClient.SqlClient
      const repo       = yield* TokenRepo
      const sessionRepo = yield* SessionRepo
      const crypto     = yield* CryptoService

      const issueTokenPair = Effect.fn("TokenService.issueTokenPair")(function* (
        userId: string,
        clientId: string,
        scopes: readonly string[],
        ipAddress: string | null,
        userAgent: string | null
      ): Effect.fn.Return<IssuedTokenPair, SqlError.SqlError> {
        return yield* sql.withTransaction(Effect.gen(function* () {
          const rawAccess      = yield* crypto.generateToken()
          const rawRefresh     = yield* crypto.generateToken()
          const accessHash     = yield* crypto.sha256(rawAccess)
          const refreshHash    = yield* crypto.sha256(rawRefresh)
          const accessExpiresAt  = new Date(Date.now() + 60 * 60 * 1000)
          const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

          const accessRecord = yield* repo.insert(
            userId, clientId, "access",
            accessHash, rawAccess.slice(-4),
            scopes, accessExpiresAt, ipAddress, userAgent
          )
          yield* repo.insert(
            userId, clientId, "refresh",
            refreshHash, rawRefresh.slice(-4),
            scopes, refreshExpiresAt, ipAddress, userAgent
          )
          yield* sessionRepo.insert(
            userId, clientId, accessRecord.id,
            refreshExpiresAt, ipAddress, userAgent
          )

          return { accessToken: rawAccess, refreshToken: rawRefresh, accessRecord }
        }))
      })

      const validateAccessToken = Effect.fn("TokenService.validateAccessToken")(function* (
        raw: string
      ): Effect.fn.Return<Token, TokenNotFoundError | TokenExpiredError | TokenRevokedError | SqlError.SqlError> {
        const hash  = yield* crypto.sha256(raw)
        const token = yield* repo.findByHash(hash)
        if (!token) return yield* new TokenNotFoundError()
        if (token.revokedAt !== null) return yield* new TokenRevokedError()
        if (token.expiresAt !== null && DateTime.isGreaterThan(DateTime.nowUnsafe(), token.expiresAt)) {
          return yield* new TokenExpiredError()
        }
        return token
      })

      const revokeToken = Effect.fn("TokenService.revokeToken")(function* (
        raw: string
      ): Effect.fn.Return<void, TokenNotFoundError | SqlError.SqlError> {
        const hash  = yield* crypto.sha256(raw)
        const token = yield* repo.findByHash(hash)
        if (!token) return yield* new TokenNotFoundError()
        yield* repo.revoke(token.id)
      })

      const revokeAllForUser = Effect.fn("TokenService.revokeAllForUser")(function* (
        userId: string,
        clientId: string
      ): Effect.fn.Return<void, SqlError.SqlError> {
        yield* repo.revokeAllForUser(userId, clientId)
      })

      return TokenService.of({ issueTokenPair, validateAccessToken, revokeToken, revokeAllForUser })
    })
  ).pipe(
    Layer.provide(TokenRepo.layer),
    Layer.provide(SessionRepo.layer),
  )
}

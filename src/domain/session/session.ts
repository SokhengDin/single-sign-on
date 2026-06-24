import { Context, Effect, Layer } from "effect"
import { SqlClient, SqlError } from "effect/unstable/sql"
import { TokenRepo } from "@/domain/token/token.sql.ts"
import { SessionExpiredError, SessionNotFoundError, SessionRevokedError } from "./session.error.ts"
import { type Session, SessionRepo } from "./session.sql.ts"
import { DateTime } from "effect"

export class SessionService extends Context.Service<SessionService, {
  findById(sessionId: string): Effect.Effect<Session, SessionNotFoundError | SessionExpiredError | SessionRevokedError | SqlError.SqlError>
  revoke(sessionId: string): Effect.Effect<void, SessionNotFoundError | SqlError.SqlError>
  findActiveByUser(userId: string, clientId: string): Effect.Effect<ReadonlyArray<Session>, SqlError.SqlError>
}>()("sso/domain/SessionService") {
  static readonly layer = Layer.effect(
    SessionService,
    Effect.gen(function* () {
      const sql         = yield* SqlClient.SqlClient
      const repo        = yield* SessionRepo
      const tokenRepo   = yield* TokenRepo

      const findById = Effect.fn("SessionService.findById")(function* (
        sessionId: string
      ): Effect.fn.Return<Session, SessionNotFoundError | SessionExpiredError | SessionRevokedError | SqlError.SqlError> {
        const session = yield* repo.findById(sessionId)
        if (!session) return yield* new SessionNotFoundError({ sessionId })
        if (session.revokedAt !== null) return yield* new SessionRevokedError()
        if (DateTime.isGreaterThan(DateTime.nowUnsafe(), session.expiresAt)) return yield* new SessionExpiredError()
        return session
      })

      const revoke = Effect.fn("SessionService.revoke")(function* (
        sessionId: string
      ): Effect.fn.Return<void, SessionNotFoundError | SqlError.SqlError> {
        const session = yield* repo.findById(sessionId)
        if (!session) return yield* new SessionNotFoundError({ sessionId })
        yield* sql.withTransaction(Effect.gen(function* () {
          yield* tokenRepo.revoke(session.tokenId)
          yield* repo.revoke(sessionId)
        }))
      })

      const findActiveByUser = Effect.fn("SessionService.findActiveByUser")(function* (
        userId: string,
        clientId: string
      ): Effect.fn.Return<ReadonlyArray<Session>, SqlError.SqlError> {
        return yield* repo.findActiveByUser(userId, clientId)
      })

      return SessionService.of({ findById, revoke, findActiveByUser })
    })
  ).pipe(
    Layer.provide(SessionRepo.layer),
    Layer.provide(TokenRepo.layer),
  )
}

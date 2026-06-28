import { Context, DateTime, Effect, Layer } from "effect"
import { SqlError } from "effect/unstable/sql"
import { CryptoService } from "@/infra/crypto.ts"
import {
  VerificationAlreadyUsedError,
  VerificationExpiredError,
  VerificationNotFoundError,
} from "./verification.error.ts"
import { type Verification, VerificationRepo } from "./verification.sql.ts"

export type QrPollStatus = "pending" | "verified" | "expired"

export class VerificationService extends Context.Service<VerificationService, {
  send(identifier: string, metadata: unknown, ttlMinutes: number): Effect.Effect<string, SqlError.SqlError>
  consume(value: string): Effect.Effect<Verification, VerificationNotFoundError | VerificationAlreadyUsedError | VerificationExpiredError | SqlError.SqlError>
  sendQr(sessionId: string, ttlMinutes: number): Effect.Effect<string, SqlError.SqlError>
  pollQr(sessionId: string): Effect.Effect<{ status: QrPollStatus; userId: string | null }, SqlError.SqlError>
  confirmQr(qrToken: string, userId: string): Effect.Effect<void, VerificationNotFoundError | VerificationAlreadyUsedError | VerificationExpiredError | SqlError.SqlError>
}>()("sso/domain/VerificationService") {
  static readonly layer = Layer.effect(
    VerificationService,
    Effect.gen(function* () {
      const repo   = yield* VerificationRepo
      const crypto = yield* CryptoService

      const send = Effect.fn("VerificationService.send")(function* (
        identifier: string,
        metadata: unknown,
        ttlMinutes: number
      ): Effect.fn.Return<string, SqlError.SqlError> {
        const value     = yield* crypto.generateToken()
        const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)
        yield* repo.insert(identifier, value, metadata, expiresAt)
        return value
      })

      const consume = Effect.fn("VerificationService.consume")(function* (
        value: string
      ): Effect.fn.Return<Verification, VerificationNotFoundError | VerificationAlreadyUsedError | VerificationExpiredError | SqlError.SqlError> {
        const verification = yield* repo.findByValue(value)
        if (!verification) return yield* new VerificationNotFoundError()
        if (verification.usedAt !== null) return yield* new VerificationAlreadyUsedError()
        if (DateTime.isGreaterThan(DateTime.nowUnsafe(), verification.expiresAt)) {
          return yield* new VerificationExpiredError()
        }
        yield* repo.markUsed(verification.id)
        return verification
      })

      const sendQr = Effect.fn("VerificationService.sendQr")(function* (
        sessionId: string,
        ttlMinutes: number
      ): Effect.fn.Return<string, SqlError.SqlError> {
        const raw       = yield* crypto.generateToken()
        const qrToken   = `qr_${raw}`
        const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)
        yield* repo.insert("qr_login", qrToken, { session_id: sessionId, status: "pending", user_id: null }, expiresAt)
        return qrToken
      })

      const pollQr = Effect.fn("VerificationService.pollQr")(function* (
        sessionId: string
      ): Effect.fn.Return<{ status: QrPollStatus; userId: string | null }, SqlError.SqlError> {
        const verification = yield* repo.findBySessionId(sessionId)

        if (!verification) return { status: "expired", userId: null }

        if (DateTime.isGreaterThan(DateTime.nowUnsafe(), verification.expiresAt)) {
          return { status: "expired", userId: null }
        }

        const meta = verification.metadata as { status?: string; user_id?: string | null } | null
        if (meta?.status === "verified") {
          return { status: "verified", userId: meta.user_id ?? null }
        }
        return { status: "pending", userId: null }
      })

      const confirmQr = Effect.fn("VerificationService.confirmQr")(function* (
        qrToken: string,
        userId: string
      ): Effect.fn.Return<void, VerificationNotFoundError | VerificationAlreadyUsedError | VerificationExpiredError | SqlError.SqlError> {
        const verification = yield* repo.findByValue(qrToken)
        if (!verification) return yield* new VerificationNotFoundError()
        if (verification.usedAt !== null) return yield* new VerificationAlreadyUsedError()
        if (DateTime.isGreaterThan(DateTime.nowUnsafe(), verification.expiresAt)) {
          return yield* new VerificationExpiredError()
        }
        const existingMeta = verification.metadata as Record<string, unknown>
        yield* repo.updatePayload(verification.id, { ...existingMeta, status: "verified", user_id: userId })
        yield* repo.markUsed(verification.id)
      })

      return VerificationService.of({ send, consume, sendQr, pollQr, confirmQr })
    })
  ).pipe(Layer.provide(VerificationRepo.layer))
}

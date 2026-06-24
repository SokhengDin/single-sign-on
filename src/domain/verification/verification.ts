import { Context, DateTime, Effect, Layer } from "effect"
import { SqlError } from "effect/unstable/sql"
import { CryptoService } from "@/infra/crypto.ts"
import {
  VerificationAlreadyUsedError,
  VerificationExpiredError,
  VerificationNotFoundError,
} from "./verification.error.ts"
import { type Verification, VerificationRepo } from "./verification.sql.ts"

export class VerificationService extends Context.Service<VerificationService, {
  send(identifier: string, metadata: unknown, ttlMinutes: number): Effect.Effect<string, SqlError.SqlError>
  consume(value: string): Effect.Effect<Verification, VerificationNotFoundError | VerificationAlreadyUsedError | VerificationExpiredError | SqlError.SqlError>
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

      return VerificationService.of({ send, consume })
    })
  ).pipe(Layer.provide(VerificationRepo.layer))
}

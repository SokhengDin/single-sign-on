import { Context, Effect, Layer } from "effect"
import { SqlError } from "effect/unstable/sql"
import { AppConfig } from "@/config/index.ts"
import { CryptoService } from "@/infra/crypto.ts"
import { JoseService, type ActiveSigningKey, type PublicJwk } from "@/infra/jose.ts"
import { NoActiveSigningKeyError, SigningKeyNotFoundError } from "./jwks.error.ts"
import { JwksRepo } from "./jwks.sql.ts"

export class JwksService extends Context.Service<JwksService, {
  generateAndStore(algorithm: string): Effect.Effect<string, SqlError.SqlError>
  getActiveSigningKey(): Effect.Effect<ActiveSigningKey, NoActiveSigningKeyError | SqlError.SqlError>
  getPublicJwks(): Effect.Effect<ReadonlyArray<PublicJwk>, SqlError.SqlError>
  rotateKey(algorithm: string): Effect.Effect<void, NoActiveSigningKeyError | SqlError.SqlError>
}>()("sso/domain/JwksService") {
  static readonly layer = Layer.effect(
    JwksService,
    Effect.gen(function* () {
      const repo   = yield* JwksRepo
      const jose   = yield* JoseService
      const crypto = yield* CryptoService
      const config = yield* AppConfig

      const generateAndStore = Effect.fn("JwksService.generateAndStore")(function* (
        algorithm: string
      ): Effect.fn.Return<string, SqlError.SqlError> {
        const kid     = yield* crypto.generateToken()
        const kp      = yield* jose.generateKeyPair(kid.slice(0, 16), algorithm).pipe(Effect.orDie)
        const encrypted = yield* crypto.encrypt(kp.privatePem, config.signingKeySecret).pipe(Effect.orDie)
        yield* repo.insert(kp.kid, algorithm, encrypted, kp.publicPem)
        return kp.kid
      })

      const getActiveSigningKey = Effect.fn("JwksService.getActiveSigningKey")(function* (): Effect.fn.Return<ActiveSigningKey, NoActiveSigningKeyError | SqlError.SqlError> {
        const key = yield* repo.findActive()
        if (!key) return yield* new NoActiveSigningKeyError()
        const decrypted  = yield* crypto.decrypt(key.privateKey, config.signingKeySecret).pipe(Effect.orDie)
        const privateKey = yield* jose.importPrivateKey(decrypted, key.algorithm).pipe(Effect.orDie)
        return { kid: key.kid, algorithm: key.algorithm, privateKey }
      })

      const getPublicJwks = Effect.fn("JwksService.getPublicJwks")(function* (): Effect.fn.Return<ReadonlyArray<PublicJwk>, SqlError.SqlError> {
        const keys = yield* repo.findPublicKeys()
        const jwks = yield* Effect.forEach(keys, (k) =>
          jose.publicKeyToJwk(k.publicKey, k.algorithm, k.kid).pipe(Effect.orDie)
        )
        return jwks
      })

      const rotateKey = Effect.fn("JwksService.rotateKey")(function* (
        algorithm: string
      ): Effect.fn.Return<void, NoActiveSigningKeyError | SqlError.SqlError> {
        const current = yield* repo.findActive()
        if (!current) return yield* new NoActiveSigningKeyError()
        const newKid = yield* generateAndStore(algorithm)
        yield* repo.rotate(current.kid, newKid)
      })

      return JwksService.of({ generateAndStore, getActiveSigningKey, getPublicJwks, rotateKey })
    })
  ).pipe(Layer.provide(JwksRepo.layer))
}

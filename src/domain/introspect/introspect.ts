import { Context, Effect, Layer } from "effect"
import { SqlError } from "effect/unstable/sql"
import { CryptoService } from "@/infra/crypto.ts"
import { TokenRepo } from "@/domain/token/token.sql.ts"
import { IntrospectResponse } from "./introspect.type.ts"
import { DateTime } from "effect"

export class IntrospectService extends Context.Service<IntrospectService, {
  introspect(rawToken: string): Effect.Effect<IntrospectResponse, SqlError.SqlError>
}>()("sso/domain/IntrospectService") {
  static readonly layer = Layer.effect(
    IntrospectService,
    Effect.gen(function* () {
      const crypto    = yield* CryptoService
      const tokenRepo = yield* TokenRepo

      const introspect = Effect.fn("IntrospectService.introspect")(function* (
        rawToken: string
      ): Effect.fn.Return<IntrospectResponse, SqlError.SqlError> {
        const hash  = yield* crypto.sha256(rawToken)
        const token = yield* tokenRepo.findByHash(hash)

        if (!token || token.revokedAt !== null) {
          return { active: false }
        }
        if (token.expiresAt !== null && DateTime.isGreaterThan(DateTime.nowUnsafe(), token.expiresAt)) {
          return { active: false }
        }

        const expSeconds = token.expiresAt
          ? Math.floor(DateTime.toEpochMillis(token.expiresAt) / 1000)
          : undefined
        const iatSeconds = Math.floor(DateTime.toEpochMillis(token.createdAt) / 1000)

        return ({
          active:      true,
          sub:         token.userId,
          client_id:   token.clientId,
          scope:       token.scopes.join(" "),
          exp:         expSeconds,
          iat:         iatSeconds,
          token_type:  token.type,
        })
      })

      return IntrospectService.of({ introspect })
    })
  ).pipe(Layer.provide(TokenRepo.layer))
}

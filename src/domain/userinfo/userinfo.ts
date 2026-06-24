import { Context, Effect, Layer } from "effect"
import { SqlError } from "effect/unstable/sql"
import { TokenService } from "@/domain/token/token.ts"
import { UserService } from "@/domain/user/user.ts"
import { AccountService } from "@/domain/account/account.ts"
import { TokenNotFoundError, TokenExpiredError, TokenRevokedError } from "@/domain/token/token.error.ts"
import { UserinfoResponse } from "./userinfo.type.ts"

export class UserinfoService extends Context.Service<UserinfoService, {
  getForToken(rawToken: string): Effect.Effect<UserinfoResponse, TokenNotFoundError | TokenExpiredError | TokenRevokedError | SqlError.SqlError>
}>()("sso/domain/UserinfoService") {
  static readonly layer = Layer.effect(
    UserinfoService,
    Effect.gen(function* () {
      const tokenService   = yield* TokenService
      const userService    = yield* UserService
      const accountService = yield* AccountService

      const getForToken = Effect.fn("UserinfoService.getForToken")(function* (
        rawToken: string
      ): Effect.fn.Return<UserinfoResponse, TokenNotFoundError | TokenExpiredError | TokenRevokedError | SqlError.SqlError> {
        const token    = yield* tokenService.validateAccessToken(rawToken)
        const user     = yield* userService.findById(token.userId).pipe(Effect.orDie)
        const accounts = yield* accountService.findAllByUser(token.userId)

        const primaryAccount = accounts[0]
        const payload = primaryAccount?.payload as Record<string, unknown> | undefined

        return new UserinfoResponse({
          sub:     token.userId,
          name:    user.displayName ?? (payload?.["name"] as string | undefined),
          picture: user.avatarUrl   ?? (payload?.["photo_url"] as string | undefined),
          email:   payload?.["email"] as string | undefined,
        })
      })

      return UserinfoService.of({ getForToken })
    })
  ).pipe(
    Layer.provide(TokenService.layer),
    Layer.provide(UserService.layer),
    Layer.provide(AccountService.layer),
  )
}

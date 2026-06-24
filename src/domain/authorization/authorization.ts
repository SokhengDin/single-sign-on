import { Context, DateTime, Effect, Layer } from "effect"
import { SqlError } from "effect/unstable/sql"
import { CryptoService } from "@/infra/crypto.ts"
import {
  AuthCodeAlreadyUsedError,
  AuthCodeExpiredError,
  AuthCodeNotFoundError,
  PKCEVerifyError,
  RedirectMismatchError,
} from "./authorization.error.ts"
import { type AuthCode, AuthorizationRepo } from "./authorization.sql.ts"

export type IssueCodeInput = {
  userId:          string
  clientId:        string
  redirectUri:     string
  scopes:          readonly string[]
  codeChallenge:   string | null
  challengeMethod: string | null
  nonce:           string | null
}

export class AuthorizationService extends Context.Service<AuthorizationService, {
  issueCode(input: IssueCodeInput): Effect.Effect<string, SqlError.SqlError>
  exchangeCode(
    code: string,
    redirectUri: string,
    codeVerifier: string | null
  ): Effect.Effect<AuthCode, AuthCodeNotFoundError | AuthCodeAlreadyUsedError | AuthCodeExpiredError | RedirectMismatchError | PKCEVerifyError | SqlError.SqlError>
}>()("sso/domain/AuthorizationService") {
  static readonly layer = Layer.effect(
    AuthorizationService,
    Effect.gen(function* () {
      const repo   = yield* AuthorizationRepo
      const crypto = yield* CryptoService

      const issueCode = Effect.fn("AuthorizationService.issueCode")(function* (
        input: IssueCodeInput
      ): Effect.fn.Return<string, SqlError.SqlError> {
        const code      = yield* crypto.generateToken()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
        yield* repo.insert(
          code,
          input.userId,
          input.clientId,
          input.redirectUri,
          input.scopes,
          input.codeChallenge,
          input.challengeMethod,
          input.nonce,
          expiresAt
        )
        return code
      })

      const exchangeCode = Effect.fn("AuthorizationService.exchangeCode")(function* (
        code: string,
        redirectUri: string,
        codeVerifier: string | null
      ): Effect.fn.Return<AuthCode, AuthCodeNotFoundError | AuthCodeAlreadyUsedError | AuthCodeExpiredError | RedirectMismatchError | PKCEVerifyError | SqlError.SqlError> {
        const authCode = yield* repo.findByCode(code)
        if (!authCode) return yield* new AuthCodeNotFoundError({ code })
        if (authCode.usedAt !== null) return yield* new AuthCodeAlreadyUsedError()
        if (DateTime.isGreaterThan(DateTime.nowUnsafe(), authCode.expiresAt)) return yield* new AuthCodeExpiredError()
        if (authCode.redirectUri !== redirectUri) return yield* new RedirectMismatchError({ redirectUri })
        if (authCode.codeChallenge !== null) {
          if (!codeVerifier) return yield* new PKCEVerifyError()
          yield* crypto.verifyPKCE(codeVerifier, authCode.codeChallenge)
        }
        yield* repo.markUsed(authCode.id)
        return authCode
      })

      return AuthorizationService.of({ issueCode, exchangeCode })
    })
  ).pipe(Layer.provide(AuthorizationRepo.layer))
}

import { Effect, Layer } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { AuthorizeParams, AuthorizeResponse } from "./authorization.type.ts"
import { TokenRequest, TokenResponse, RevokeRequest } from "@/domain/token/token.type.ts"
import { IntrospectRequest, IntrospectResponse } from "@/domain/introspect/introspect.type.ts"
import { UserinfoResponse } from "@/domain/userinfo/userinfo.type.ts"
import { AuthorizationService } from "./authorization.ts"
import { ClientService } from "@/domain/client/client.ts"
import { TokenService } from "@/domain/token/token.ts"
import { IntrospectService } from "@/domain/introspect/introspect.ts"
import { UserinfoService } from "@/domain/userinfo/userinfo.ts"
import { JwksService } from "@/domain/jwks/jwks.ts"
import { AppConfig } from "@/config/index.ts"
import { JoseService } from "@/infra/jose.ts"

export class OAuthApi extends HttpApi.make("oauth-api")
  .add(
    HttpApiGroup.make("oauth")
      .add(HttpApiEndpoint.get("authorize", "/authorize", {
        query:   AuthorizeParams.fields,
        success: AuthorizeResponse,
      }))
      .add(HttpApiEndpoint.post("token", "/token", {
        payload: TokenRequest,
        success: TokenResponse,
      }))
      .add(HttpApiEndpoint.post("revoke", "/revoke", {
        payload: RevokeRequest,
        success: HttpApiSchema.NoContent,
      }))
      .add(HttpApiEndpoint.post("introspect", "/introspect", {
        payload: IntrospectRequest,
        success: IntrospectResponse,
      }))
      .add(HttpApiEndpoint.get("userinfo", "/userinfo", {
        success: UserinfoResponse,
      }))
      .prefix("/api")
  )
{}

export const AuthorizationHandlers = HttpApiBuilder.group(
  OAuthApi,
  "oauth",
  Effect.fn(function* (handlers) {
    const authorization = yield* AuthorizationService
    const clients       = yield* ClientService
    const tokens        = yield* TokenService
    const introspect    = yield* IntrospectService
    const userinfo      = yield* UserinfoService
    const jwks          = yield* JwksService
    const jose          = yield* JoseService
    const config        = yield* AppConfig

    return handlers
      .handle("authorize", ({ query }) =>
        Effect.gen(function* () {
          const client = yield* clients.validateClient(query.client_id, undefined, query.redirect_uri)
          const code   = yield* authorization.issueCode({
            userId:          "",
            clientId:        client.id,
            redirectUri:     query.redirect_uri,
            scopes:          query.scope.split(" "),
            codeChallenge:   query.code_challenge ?? null,
            challengeMethod: query.code_challenge_method ?? null,
            nonce:           query.nonce ?? null,
          })
          return ({ redirect_uri: `${query.redirect_uri}?code=${code}&state=${query.state ?? ""}` })
        }).pipe(Effect.orDie)
      )
      .handle("token", ({ payload, request }) =>
        Effect.gen(function* () {
          const ipAddress = request.headers["x-forwarded-for"] as string | null ?? null
          const userAgent = request.headers["user-agent"] as string | null ?? null

          if (payload.grant_type === "authorization_code") {
            if (!payload.code || !payload.redirect_uri) {
              return yield* Effect.die("missing code or redirect_uri")
            }
            const authCode = yield* authorization.exchangeCode(
              payload.code,
              payload.redirect_uri,
              payload.code_verifier ?? null,
            ).pipe(Effect.orDie)

            const issued = yield* tokens.issueTokenPair(
              authCode.userId,
              authCode.clientId,
              authCode.scopes,
              ipAddress,
              userAgent,
            )

            const signingKey = yield* jwks.getActiveSigningKey().pipe(Effect.orDie)
            const idToken    = yield* jose.signIdToken(
              {
                sub:   authCode.userId,
                iss:   config.appUrl,
                aud:   authCode.clientId,
                nonce: authCode.nonce ?? undefined,
              },
              signingKey,
              "1h",
            ).pipe(Effect.orDie)

            return ({
              access_token:  issued.accessToken,
              token_type:    "Bearer",
              expires_in:    3600,
              refresh_token: issued.refreshToken,
              id_token:      idToken,
              scope:         authCode.scopes.join(" "),
            })
          }

          if (payload.grant_type === "refresh_token") {
            if (!payload.refresh_token) return yield* Effect.die("missing refresh_token")
            const old = yield* tokens.validateAccessToken(payload.refresh_token).pipe(Effect.orDie)
            yield* tokens.revokeToken(payload.refresh_token).pipe(Effect.orDie)
            const issued = yield* tokens.issueTokenPair(
              old.userId,
              old.clientId,
              old.scopes,
              ipAddress,
              userAgent,
            )
            return ({
              access_token:  issued.accessToken,
              token_type:    "Bearer",
              expires_in:    3600,
              refresh_token: issued.refreshToken,
              scope:         old.scopes.join(" "),
            })
          }

          return yield* Effect.die(`unsupported grant_type: ${payload.grant_type}`)
        }).pipe(Effect.orDie)
      )
      .handle("revoke", ({ payload }) =>
        tokens.revokeToken(payload.token).pipe(
          Effect.as(void 0),
          Effect.orDie,
        )
      )
      .handle("introspect", ({ payload }) =>
        introspect.introspect(payload.token).pipe(Effect.orDie)
      )
      .handle("userinfo", ({ request }) =>
        Effect.gen(function* () {
          const auth = request.headers["authorization"] as string | undefined
          if (!auth?.startsWith("Bearer ")) return yield* Effect.die("missing Bearer token")
          const raw = auth.slice(7)
          return yield* userinfo.getForToken(raw).pipe(Effect.orDie)
        }).pipe(Effect.orDie)
      )
  })
).pipe(
  Layer.provide(AuthorizationService.layer),
  Layer.provide(ClientService.layer),
  Layer.provide(TokenService.layer),
  Layer.provide(IntrospectService.layer),
  Layer.provide(UserinfoService.layer),
  Layer.provide(JwksService.layer),
)

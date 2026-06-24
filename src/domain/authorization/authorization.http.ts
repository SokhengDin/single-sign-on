import { Effect, Layer } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { AuthorizeParams, AuthorizeResponse } from "./authorization.type.ts"
import { TokenRequest, TokenResponse, RevokeRequest } from "@/domain/token/token.type.ts"
import { IntrospectRequest, IntrospectResponse } from "@/domain/introspect/introspect.type.ts"
import { UserinfoResponse } from "@/domain/userinfo/userinfo.type.ts"
import { AuthorizationService } from "./authorization.ts"
import { ClientService } from "@/domain/client/client.ts"

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

    return handlers
      .handle("authorize", ({ query }) =>
        Effect.gen(function* () {
          const client      = yield* clients.validateClient(query.client_id, undefined, query.redirect_uri)
          const redirectUri = query.redirect_uri
          const code        = yield* authorization.issueCode({
            userId:          "",
            clientId:        client.id,
            redirectUri,
            scopes:          query.scope.split(" "),
            codeChallenge:   query.code_challenge ?? null,
            challengeMethod: query.code_challenge_method ?? null,
            nonce:           query.nonce ?? null,
          })
          return new AuthorizeResponse({ redirect_uri: `${redirectUri}?code=${code}&state=${query.state ?? ""}` })
        }).pipe(Effect.orDie)
      )
      .handle("token", () => Effect.die("not implemented"))
      .handle("revoke", () => Effect.die("not implemented"))
      .handle("introspect", () => Effect.die("not implemented"))
      .handle("userinfo", () => Effect.die("not implemented"))
  })
).pipe(
  Layer.provide(AuthorizationService.layer),
  Layer.provide(ClientService.layer),
)

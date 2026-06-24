import { Effect, Layer } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { JwksResponse } from "@/domain/jwks/jwks.type.ts"
import { OidcDiscovery } from "./discovery.type.ts"
import { JwksService } from "@/domain/jwks/jwks.ts"
import { makeDiscovery } from "./discovery.http.ts"

export class WellKnownApi extends HttpApi.make("well-known-api")
  .add(
    HttpApiGroup.make("wellKnown")
      .add(HttpApiEndpoint.get("jwks", "/.well-known/jwks.json", {
        success: JwksResponse,
      }))
      .add(HttpApiEndpoint.get("discovery", "/.well-known/openid-configuration", {
        success: OidcDiscovery,
      }))
  )
{}

export const WellKnownHandlers = HttpApiBuilder.group(
  WellKnownApi,
  "wellKnown",
  Effect.fn(function* (handlers) {
    const jwks = yield* JwksService

    return handlers
      .handle("jwks", () =>
        jwks.getPublicJwks().pipe(
          Effect.map((keys) => ({ keys: keys as ReadonlyArray<Record<string, unknown>> })),
          Effect.orDie,
        )
      )
      .handle("discovery", () =>
        makeDiscovery().pipe(Effect.orDie)
      )
  })
).pipe(Layer.provide(JwksService.layer))

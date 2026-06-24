import { Schema } from "effect"
import { Effect, Layer } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { JwksService } from "@/domain/jwks/jwks.ts"
import { ApiResponse, apiOk } from "@/infra/response.ts"
import { GenerateKeyInput, KeyResponse } from "./keys.type.ts"

export class KeysApi extends HttpApi.make("keys-api")
  .add(
    HttpApiGroup.make("keys")
      .add(HttpApiEndpoint.post("generate", "/keys/generate", {
        payload: GenerateKeyInput,
        success: ApiResponse(KeyResponse),
      }))
      .add(HttpApiEndpoint.post("rotate", "/keys/rotate", {
        payload: GenerateKeyInput,
        success: HttpApiSchema.NoContent,
      }))
      .prefix("/api")
  )
{}

export const KeysHandlers = HttpApiBuilder.group(
  KeysApi,
  "keys",
  Effect.fn(function* (handlers) {
    const jwks = yield* JwksService

    return handlers
      .handle("generate", ({ payload }) =>
        jwks.generateAndStore(payload.algorithm ?? "RS256").pipe(
          Effect.map(kid => apiOk({ kid, algorithm: payload.algorithm ?? "RS256", is_active: true })),
          Effect.orDie,
        )
      )
      .handle("rotate", ({ payload }) =>
        jwks.rotateKey(payload.algorithm ?? "RS256").pipe(
          Effect.as(void 0),
          Effect.orDie,
        )
      )
  })
).pipe(Layer.provide(JwksService.layer))

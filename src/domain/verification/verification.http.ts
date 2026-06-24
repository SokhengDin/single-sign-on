import { Effect, Layer } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { VerificationSendInput, VerificationConsumeInput } from "./verification.type.ts"
import { VerificationService } from "./verification.ts"

export class VerificationApi extends HttpApi.make("verification-api")
  .add(
    HttpApiGroup.make("verification")
      .add(HttpApiEndpoint.post("sendVerification", "/verification/send", {
        payload: VerificationSendInput,
        success: HttpApiSchema.NoContent,
      }))
      .add(HttpApiEndpoint.post("consumeVerification", "/verification/consume", {
        payload: VerificationConsumeInput,
        success: HttpApiSchema.NoContent,
      }))
      .prefix("/api")
  )
{}

export const VerificationHandlers = HttpApiBuilder.group(
  VerificationApi,
  "verification",
  Effect.fn(function* (handlers) {
    const verifications = yield* VerificationService

    return handlers
      .handle("sendVerification", ({ payload }) =>
        verifications.send(payload.identifier, payload.metadata ?? {}, 15).pipe(
          Effect.as(void 0),
          Effect.orDie,
        )
      )
      .handle("consumeVerification", ({ payload }) =>
        verifications.consume(payload.value).pipe(Effect.as(void 0), Effect.orDie)
      )
  })
).pipe(Layer.provide(VerificationService.layer))

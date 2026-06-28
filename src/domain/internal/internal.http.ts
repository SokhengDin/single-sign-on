import { Effect, Layer } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { ProviderConfirmBody } from "./internal.type.ts"
import { VerificationService } from "@/domain/verification/verification.ts"
import { AccountService } from "@/domain/account/account.ts"
import { ClientService } from "@/domain/client/client.ts"
import { httpError, unwrapHttpErrors } from "@/infra/response.ts"

export class InternalApi extends HttpApi.make("internal-api")
  .add(
    HttpApiGroup.make("internal")
      .add(HttpApiEndpoint.post("providerConfirm", "/internal/confirm", {
        payload: ProviderConfirmBody,
        success: HttpApiSchema.NoContent,
      }))
  ).prefix("/api")
{}

export const InternalHandlers = HttpApiBuilder.group(
  InternalApi,
  "internal",
  Effect.fn(function* (handlers) {
    const verifications = yield* VerificationService
    const accounts      = yield* AccountService
    const clients       = yield* ClientService

    return handlers
      .handle("providerConfirm", ({ payload, request }) =>
        unwrapHttpErrors(
          Effect.gen(function* () {
            const serviceKey = request.headers["x-service-key"] as string | undefined ?? ""
            if (!serviceKey) return yield* httpError(401, "missing credentials")

            yield* clients.verifyCredentials(payload.client_id, serviceKey).pipe(
              Effect.catchTag("ClientNotFoundError",      () => httpError(401, "invalid credentials")),
              Effect.catchTag("InvalidClientSecretError", () => httpError(401, "invalid credentials")),
              Effect.catchTag("SqlError",                 () => httpError(503, "service unavailable")),
            )

            const displayName = [payload.first_name, payload.last_name].filter(Boolean).join(" ")
              || payload.username
              || payload.provider_id

            const client = yield* clients.findByClientId(payload.client_id).pipe(
              Effect.catchTag("ClientNotFoundError", () => httpError(401, "invalid credentials")),
              Effect.catchTag("SqlError",            () => httpError(503, "service unavailable")),
            )

            const account = yield* accounts.upsert({
              provider:     client.name,
              provider_id:  payload.provider_id,
              display_name: displayName,
              payload: {
                username:   payload.username,
                first_name: payload.first_name,
                last_name:  payload.last_name,
              },
              scope: ["openid", "profile"],
            }).pipe(
              Effect.catchTag("SqlError", () => httpError(503, "service unavailable")),
            )

            yield* verifications.confirmQr(payload.qr_token, account.user_id).pipe(
              Effect.catchTag("VerificationNotFoundError",    () => httpError(404, "qr token not found")),
              Effect.catchTag("VerificationAlreadyUsedError", () => httpError(400, "qr token already used")),
              Effect.catchTag("VerificationExpiredError",     () => httpError(400, "qr token expired")),
              Effect.catchTag("SqlError",                     () => httpError(503, "service unavailable")),
            )
          })
        )
      )
  })
).pipe(
  Layer.provide(VerificationService.layer),
  Layer.provide(AccountService.layer),
  Layer.provide(ClientService.layer),
)

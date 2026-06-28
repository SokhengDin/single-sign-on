import { Effect, Layer } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { QrQuery, QrResponse, PollQuery, PollResponse } from "./login.type.ts"
import { VerificationService } from "@/domain/verification/verification.ts"
import { ClientService } from "@/domain/client/client.ts"
import { apiOk, httpError, unwrapHttpErrors } from "@/infra/response.ts"

export class LoginApi extends HttpApi.make("login-api")
  .add(
    HttpApiGroup.make("login")
      .add(HttpApiEndpoint.get("getQr", "/login/qr", {
        query:   QrQuery.fields,
        success: QrResponse,
      }))
      .add(HttpApiEndpoint.get("pollQr", "/login/poll", {
        query:   PollQuery.fields,
        success: PollResponse,
      }))
  ).prefix("/api")
{}

export const LoginHandlers = HttpApiBuilder.group(
  LoginApi,
  "login",
  Effect.fn(function* (handlers) {
    const verifications = yield* VerificationService
    const clients       = yield* ClientService

    return handlers
      .handle("getQr", ({ query }) =>
        unwrapHttpErrors(
          Effect.gen(function* () {
            const client = yield* clients.findByClientId(query.client_id).pipe(
              Effect.catchTag("ClientNotFoundError", () => httpError(400, "invalid client_id")),
              Effect.catchTag("SqlError",            () => httpError(503, "service unavailable")),
            )
            if (!client.is_active) return yield* httpError(400, "client is inactive")

            const qrToken = yield* verifications.sendQr(query.session_id, 5).pipe(
              Effect.catchTag("SqlError", () => httpError(503, "service unavailable")),
            )

            const qrUrl = `https://t.me/${client.name}?startapp=${qrToken}`
            return apiOk({ session_id: query.session_id, qr_url: qrUrl, expires_in: 300 })
          })
        )
      )
      .handle("pollQr", ({ query }) =>
        unwrapHttpErrors(
          Effect.gen(function* () {
            const result = yield* verifications.pollQr(query.session_id).pipe(
              Effect.catchTag("SqlError", () => httpError(503, "service unavailable")),
            )
            return apiOk({ status: result.status, user_id: result.userId ?? undefined })
          })
        )
      )
  })
).pipe(
  Layer.provide(VerificationService.layer),
  Layer.provide(ClientService.layer),
)

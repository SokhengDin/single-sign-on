import { Schema } from "effect"
import { Effect, Layer } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { Account, UpsertAccountInput } from "./account.type.ts"
import { AccountService } from "./account.ts"
import { ApiListResponse, ApiResponse, apiOk } from "@/infra/response.ts"

export class AccountApi extends HttpApi.make("account-api")
  .add(
    HttpApiGroup.make("account")
      .add(HttpApiEndpoint.post("upsertAccount", "/account", {
        payload: UpsertAccountInput,
        success: ApiResponse(Account),
      }))
      .add(HttpApiEndpoint.get("getAccountsByUser", "/account/user/:user_id", {
        params:  { user_id: Schema.String },
        success: ApiListResponse(Account),
      }))
      .prefix("/api")
  )
{}

export const AccountHandlers = HttpApiBuilder.group(
  AccountApi,
  "account",
  Effect.fn(function* (handlers) {
    const accounts = yield* AccountService

    return handlers
      .handle("upsertAccount", ({ payload }) =>
        accounts.upsert(payload).pipe(Effect.map(data => apiOk(data)), Effect.orDie)
      )
      .handle("getAccountsByUser", ({ params }) =>
        accounts.findAllByUser(params.user_id).pipe(Effect.map(data => apiOk(data)), Effect.orDie)
      )
  })
).pipe(Layer.provide(AccountService.layer))

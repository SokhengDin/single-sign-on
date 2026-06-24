import { Schema } from "effect"
import { Effect, Layer } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { UserService } from "@/domain/user/user.ts"
import { LinkedAccount, LinkAccountInput } from "@/domain/user/user.type.ts"
import { ApiResponse, ApiListResponse, apiOk } from "@/infra/response.ts"

export class LinkingApi extends HttpApi.make("linking-api")
  .add(
    HttpApiGroup.make("linking")
      .add(HttpApiEndpoint.post("link", "/user/:id/linked-accounts", {
        params:  { id: Schema.String },
        payload: LinkAccountInput,
        success: ApiResponse(LinkedAccount),
      }))
      .add(HttpApiEndpoint.get("list", "/user/:id/linked-accounts", {
        params:  { id: Schema.String },
        success: ApiListResponse(LinkedAccount),
      }))
      .add(HttpApiEndpoint.delete("unlink", "/user/:id/linked-accounts/:external_system", {
        params:  { id: Schema.String, externalSystem: Schema.String },
        success: HttpApiSchema.NoContent,
      }))
      .prefix("/api")
  )
{}

export const LinkingHandlers = HttpApiBuilder.group(
  LinkingApi,
  "linking",
  Effect.fn(function* (handlers) {
    const users = yield* UserService

    return handlers
      .handle("link", ({ params, payload }) =>
        users.linkAccount({ ...payload, user_id: params.id }).pipe(
          Effect.map(data => apiOk(data)),
          Effect.orDie,
        )
      )
      .handle("list", ({ params }) =>
        users.getLinkedAccounts(params.id).pipe(
          Effect.map(data => apiOk(data)),
          Effect.orDie,
        )
      )
      .handle("unlink", ({ params }) =>
        users.unlinkAccount(params.id, params.externalSystem).pipe(
          Effect.as(void 0),
          Effect.orDie,
        )
      )
  })
).pipe(Layer.provide(UserService.layer))

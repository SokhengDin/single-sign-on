import { Schema } from "effect"
import { Effect, Layer } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { CreateUserInput, LinkAccountInput, LinkedAccount, UpdateUserInput, User } from "./user.type.ts"
import { UserService } from "./user.ts"
import { ApiListResponse, ApiResponse, apiOk, httpError, unwrapHttpErrors } from "@/infra/response.ts"

export class UserApi extends HttpApi.make("user-api")
  .add(
    HttpApiGroup.make("user")
      .add(HttpApiEndpoint.post("createUser", "/user", {
        payload: CreateUserInput,
        success: ApiResponse(User),
      }))
      .add(HttpApiEndpoint.get("getUser", "/user/:user_id", {
        params:  { user_id: Schema.String },
        success: ApiResponse(User),
      }))
      .add(HttpApiEndpoint.patch("updateUser", "/user/:user_id", {
        params:  { user_id: Schema.String },
        payload: UpdateUserInput,
        success: ApiResponse(User),
      }))
      .add(HttpApiEndpoint.delete("deleteUser", "/user/:user_id", {
        params:  { user_id: Schema.String },
        success: HttpApiSchema.NoContent,
      }))
      .add(HttpApiEndpoint.post("linkAccount", "/user/linked-account", {
        payload: LinkAccountInput,
        success: ApiResponse(LinkedAccount),
      }))
      .add(HttpApiEndpoint.delete("unlinkAccount", "/user/:user_id/linked-account/:external_system", {
        params:  { user_id: Schema.String, external_system: Schema.String },
        success: HttpApiSchema.NoContent,
      }))
      .add(HttpApiEndpoint.get("getLinkedAccounts", "/user/:user_id/linked-account", {
        params:  { user_id: Schema.String },
        success: ApiListResponse(LinkedAccount),
      }))
      .prefix("/api")
  )
{}

export const UserHandlers = HttpApiBuilder.group(
  UserApi,
  "user",
  Effect.fn(function* (handlers) {
    const users = yield* UserService

    return handlers
      .handle("createUser", ({ payload }) =>
        users.create(payload).pipe(Effect.map(data => apiOk(data)), Effect.orDie)
      )
      .handle("getUser", ({ params }) =>
        users.findById(params.user_id).pipe(Effect.map(data => apiOk(data)), Effect.orDie)
      )
      .handle("updateUser", ({ params, payload }) =>
        users.update(params.user_id, payload).pipe(Effect.map(data => apiOk(data)), Effect.orDie)
      )
      .handle("deleteUser", ({ params }) =>
        users.softDelete(params.user_id).pipe(Effect.as(void 0), Effect.orDie)
      )
      .handle("linkAccount", ({ payload }) =>
        unwrapHttpErrors(
          users.linkAccount(payload).pipe(
            Effect.map(data => apiOk(data)),
            Effect.catchTag("LinkedAccountConflictError", () => httpError(409, "linked account already exists")),
            Effect.catchTag("SqlError", () => httpError(503, "service unavailable")),
          )
        )
      )
      .handle("unlinkAccount", ({ params }) =>
        users.unlinkAccount(params.user_id, params.external_system).pipe(Effect.as(void 0), Effect.orDie)
      )
      .handle("getLinkedAccounts", ({ params }) =>
        users.getLinkedAccounts(params.user_id).pipe(Effect.map(data => apiOk(data)), Effect.orDie)
      )
  })
).pipe(Layer.provide(UserService.layer))

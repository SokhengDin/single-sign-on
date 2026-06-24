import { Schema } from "effect"
import { Effect, Layer } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { Client, CreateClientInput, UpdateClientInput } from "./client.type.ts"
import { ClientService } from "./client.ts"
import { ApiResponse, apiOk } from "@/infra/response.ts"

export class ClientApi extends HttpApi.make("client-api")
  .add(
    HttpApiGroup.make("client")
      .add(HttpApiEndpoint.post("createClient", "/client", {
        payload: CreateClientInput,
        success: ApiResponse(Client),
      }))
      .add(HttpApiEndpoint.get("getClient", "/client/:id", {
        params:  { id: Schema.String },
        success: ApiResponse(Client),
      }))
      .add(HttpApiEndpoint.patch("updateClient", "/client/:id", {
        params:  { id: Schema.String },
        payload: UpdateClientInput,
        success: ApiResponse(Client),
      }))
      .add(HttpApiEndpoint.delete("deactivateClient", "/client/:id", {
        params:  { id: Schema.String },
        success: HttpApiSchema.NoContent,
      }))
      .prefix("/api")
  )
{}

export const ClientHandlers = HttpApiBuilder.group(
  ClientApi,
  "client",
  Effect.fn(function* (handlers) {
    const clients = yield* ClientService

    return handlers
      .handle("createClient", ({ payload }) =>
        clients.create(payload).pipe(Effect.map(data => apiOk(data)), Effect.orDie)
      )
      .handle("getClient", ({ params }) =>
        clients.findById(params.id).pipe(Effect.map(data => apiOk(data)), Effect.orDie)
      )
      .handle("updateClient", ({ params, payload }) =>
        clients.update(params.id, payload).pipe(Effect.map(data => apiOk(data)), Effect.orDie)
      )
      .handle("deactivateClient", ({ params }) =>
        clients.deactivate(params.id).pipe(Effect.as(void 0), Effect.orDie)
      )
  })
).pipe(Layer.provide(ClientService.layer))

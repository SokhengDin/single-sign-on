import { Context, DateTime, Effect, Layer } from "effect"
import { SqlClient, SqlError } from "effect/unstable/sql"
import { Client } from "./client.type.ts"

type ClientRow = {
  id:            string
  name:          string
  client_id:     string
  client_secret: string | null
  redirect_uris: string[]
  scopes:        string[]
  grant_types:   string[]
  is_public:     boolean
  is_active:     boolean
  created_at:    Date
  updated_at:    Date | null
}

const toClient = (row: ClientRow): Client => ({
  id:           row.id,
  name:         row.name,
  clientId:     row.client_id,
  redirectUris: row.redirect_uris,
  scopes:       row.scopes,
  grantTypes:   row.grant_types,
  isPublic:     row.is_public,
  isActive:     row.is_active,
  createdAt:    DateTime.fromDateUnsafe(row.created_at),
  updatedAt:    row.updated_at ? DateTime.fromDateUnsafe(row.updated_at) : null,
})

export class ClientRepo extends Context.Service<ClientRepo, {
  insert(
    name: string,
    clientId: string,
    clientSecretHash: string | null,
    redirectUris: readonly string[],
    scopes: readonly string[],
    grantTypes: readonly string[],
    isPublic: boolean
  ): Effect.Effect<Client, SqlError.SqlError>

  findByClientId(clientId: string): Effect.Effect<Client | null, SqlError.SqlError>

  findById(id: string): Effect.Effect<Client | null, SqlError.SqlError>

  update(
    id: string,
    name: string | undefined,
    redirectUris: readonly string[] | undefined,
    scopes: readonly string[] | undefined,
    grantTypes: readonly string[] | undefined
  ): Effect.Effect<Client | null, SqlError.SqlError>

  deactivate(id: string): Effect.Effect<void, SqlError.SqlError>

}>()("sso/domain/ClientRepo") {
  static readonly layer = Layer.effect(
    ClientRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const insert = Effect.fn("ClientRepo.insert")(function* (
        name: 		string,
        clientId: string,
        clientSecretHash: string | null,
        redirectUris: 		readonly string[],
        scopes: 					readonly string[],
        grantTypes: 			readonly string[],
        isPublic: boolean
      ) {
        const rows = yield* sql<ClientRow>`
          INSERT INTO client (name, client_id, client_secret, redirect_uris, scopes, grant_types, is_public)
          VALUES (${name}, ${clientId}, ${clientSecretHash}, ${redirectUris}, ${scopes}, ${grantTypes}, ${isPublic})
          RETURNING *
        `
        return toClient(rows[0]!)
      })

      const findByClientId = Effect.fn("ClientRepo.findByClientId")(function* (clientId: string) {
        const rows = yield* sql<ClientRow>`
          SELECT * FROM client WHERE client_id = ${clientId}
        `
        return rows[0] ? toClient(rows[0]) : null
      })

      const findById = Effect.fn("ClientRepo.findById")(function* (id: string) {
        const rows = yield* sql<ClientRow>`
          SELECT * FROM client WHERE id = ${id}
        `
        return rows[0] ? toClient(rows[0]) : null
      })

      const update = Effect.fn("ClientRepo.update")(function* (
        id: string,
        name: string | undefined,
        redirectUris: readonly string[] | undefined,
        scopes: readonly string[] | undefined,
        grantTypes: readonly string[] | undefined
      ) {
        const rows = yield* sql<ClientRow>`
          UPDATE client
          SET
            name          = COALESCE(${name ?? null}, name),
            redirect_uris = COALESCE(${redirectUris ?? null}, redirect_uris),
            scopes        = COALESCE(${scopes ?? null}, scopes),
            grant_types   = COALESCE(${grantTypes ?? null}, grant_types),
            updated_at    = now()
          WHERE id = ${id}
          RETURNING *
        `
        return rows[0] ? toClient(rows[0]) : null
      })

      const deactivate = Effect.fn("ClientRepo.deactivate")(function* (id: string) {
        yield* sql`
          UPDATE client SET is_active = false, updated_at = now() WHERE id = ${id}
        `
      })

      return ClientRepo.of({ insert, findByClientId, findById, update, deactivate })
    })
  )
}

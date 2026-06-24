import { Config, Effect, Schema } from "effect"
import { PgClient } from "@effect/sql-pg"
import type { SqlClient as SqlClientService } from "effect/unstable/sql/SqlClient"

export class DatabaseError extends Schema.TaggedErrorClass<DatabaseError>()("DatabaseError", {
  cause: Schema.Defect(),
}) {}

export const SqlLive = PgClient.layerConfig({
  host:     Config.string("DB_HOST"),
  port:     Config.int("DB_PORT"),
  username: Config.string("DB_USER"),
  password: Config.redacted("DB_PASSWORD"),
  database: Config.string("DB_NAME"),
  ssl:      Config.string("DB_SSLMODE").pipe(Config.map(v => v === "require")),
})

export type WithTransaction = <A, E, R>(
  effect: Effect.Effect<A, E, R>
) => Effect.Effect<A, E | DatabaseError, R>

export function makeWithTransaction(
  withTransaction: SqlClientService["withTransaction"]
): WithTransaction {
  return (effect) =>
    withTransaction(effect).pipe(
      Effect.catchTag("SqlError", (cause) => Effect.fail(new DatabaseError({ cause })))
    ) as any
}

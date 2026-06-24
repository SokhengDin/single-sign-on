import { BunRuntime } from "@effect/platform-bun"
import { Config, Effect, Layer } from "effect"
import { SqlClient } from "effect/unstable/sql"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import pg from "pg"
import { SqlLive } from "@/infra/sql.ts"

const MIGRATIONS_DIR   = join(import.meta.dir, "migrations")
const MIGRATIONS_TABLE = "schema_migrations"

const ensureMigrationsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(MIGRATIONS_TABLE)} (
      filename   TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
})

const checkApplied = (filename: string) =>
  Effect.gen(function* () {
    const sql  = yield* SqlClient.SqlClient
    const rows = yield* sql<{ count: string }>`
      SELECT COUNT(*) AS count FROM ${sql.unsafe(MIGRATIONS_TABLE)}
      WHERE filename = ${filename}
    `
    return parseInt(rows[0]?.count ?? "0", 10) > 0
  })

const recordApplied = (filename: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`
      INSERT INTO ${sql.unsafe(MIGRATIONS_TABLE)} (filename)
      VALUES (${filename})
      ON CONFLICT DO NOTHING
    `
  })

const runSqlFile = (filepath: string) =>
  Effect.gen(function* () {
    const host     = yield* Config.string("DB_HOST")
    const port     = yield* Config.int("DB_PORT")
    const user     = yield* Config.string("DB_USER")
    const password = yield* Config.string("DB_PASSWORD")
    const database = yield* Config.string("DB_NAME")

    const text   = readFileSync(filepath, "utf8")
    const client = new pg.Client({ host, port, user, password, database })

    yield* Effect.tryPromise({
      try:   async () => { await client.connect(); await client.query(text); await client.end() },
      catch: (e)     => e as Error,
    })
  })

const runMigrations = Effect.gen(function* () {
  yield* ensureMigrationsTable

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()

  for (const file of files) {
    const applied = yield* checkApplied(file)
    if (applied) {
      yield* Effect.log(`skip: ${file}`)
      continue
    }
    yield* Effect.log(`apply: ${file}`)
    yield* runSqlFile(join(MIGRATIONS_DIR, file))
    yield* recordApplied(file)
    yield* Effect.log(`done: ${file}`)
  }

  yield* Effect.log("migrations complete")
})

BunRuntime.runMain(runMigrations.pipe(Effect.provide(SqlLive)))

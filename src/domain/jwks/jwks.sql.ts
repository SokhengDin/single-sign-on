import { Context, DateTime, Effect, Layer } from "effect"
import { SqlClient, SqlError } from "effect/unstable/sql"

export type SigningKey = {
  id:         string
  kid:        string
  algorithm:  string
  privateKey: string
  publicKey:  string
  isActive:   boolean
  rotatedAt:  DateTime.Utc | null
  expiresAt:  DateTime.Utc | null
  createdAt:  DateTime.Utc
}

type SigningKeyRow = {
  id:          string
  kid:         string
  algorithm:   string
  private_key: string
  public_key:  string
  is_active:   boolean
  rotated_at:  Date | null
  expires_at:  Date | null
  created_at:  Date
}

const toSigningKey = (row: SigningKeyRow): SigningKey => ({
  id:         row.id,
  kid:        row.kid,
  algorithm:  row.algorithm,
  privateKey: row.private_key,
  publicKey:  row.public_key,
  isActive:   row.is_active,
  rotatedAt:  row.rotated_at ? DateTime.fromDateUnsafe(row.rotated_at) : null,
  expiresAt:  row.expires_at ? DateTime.fromDateUnsafe(row.expires_at) : null,
  createdAt:  DateTime.fromDateUnsafe(row.created_at),
})

export class JwksRepo extends Context.Service<JwksRepo, {
  insert(kid: string, algorithm: string, encryptedPrivateKey: string, publicKey: string): Effect.Effect<SigningKey, SqlError.SqlError>
  findActive(): Effect.Effect<SigningKey | null, SqlError.SqlError>
  findByKid(kid: string): Effect.Effect<SigningKey | null, SqlError.SqlError>
  findPublicKeys(): Effect.Effect<ReadonlyArray<SigningKey>, SqlError.SqlError>
  rotate(oldKid: string, newKid: string): Effect.Effect<void, SqlError.SqlError>
}>()("sso/domain/JwksRepo") {
  static readonly layer = Layer.effect(
    JwksRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const insert = Effect.fn("JwksRepo.insert")(function* (
        kid: string,
        algorithm: string,
        encryptedPrivateKey: string,
        publicKey: string
      ) {
        const rows = yield* sql<SigningKeyRow>`
          INSERT INTO signing_key (kid, algorithm, private_key, public_key)
          VALUES (${kid}, ${algorithm}, ${encryptedPrivateKey}, ${publicKey})
          RETURNING *
        `
        return toSigningKey(rows[0]!)
      })

      const findActive = Effect.fn("JwksRepo.findActive")(function* () {
        const rows = yield* sql<SigningKeyRow>`
          SELECT * FROM signing_key WHERE is_active = true ORDER BY created_at DESC LIMIT 1
        `
        return rows[0] ? toSigningKey(rows[0]) : null
      })

      const findByKid = Effect.fn("JwksRepo.findByKid")(function* (kid: string) {
        const rows = yield* sql<SigningKeyRow>`
          SELECT * FROM signing_key WHERE kid = ${kid}
        `
        return rows[0] ? toSigningKey(rows[0]) : null
      })

      const findPublicKeys = Effect.fn("JwksRepo.findPublicKeys")(function* () {
        const rows = yield* sql<SigningKeyRow>`
          SELECT * FROM signing_key
          WHERE is_active = true
             OR (rotated_at IS NOT NULL AND rotated_at + interval '2 hours' > now())
          ORDER BY created_at DESC
        `
        return rows.map(toSigningKey)
      })

      const rotate = Effect.fn("JwksRepo.rotate")(function* (oldKid: string, newKid: string) {
        yield* sql`
          UPDATE signing_key SET is_active = false, rotated_at = now() WHERE kid = ${oldKid}
        `
        yield* sql`
          UPDATE signing_key SET is_active = true WHERE kid = ${newKid}
        `
      })

      return JwksRepo.of({ insert, findActive, findByKid, findPublicKeys, rotate })
    })
  )
}

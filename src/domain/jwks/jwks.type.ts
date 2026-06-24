import { Schema } from "effect"

export const JwksResponse = Schema.Struct({
  keys: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
})
export type JwksResponse = Schema.Schema.Type<typeof JwksResponse>

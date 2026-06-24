import { Schema } from "effect"

export class JwksResponse extends Schema.Class<JwksResponse>("JwksResponse")({
  keys: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
}) {}

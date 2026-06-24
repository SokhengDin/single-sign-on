import { Schema } from "effect"

export class UserinfoResponse extends Schema.Class<UserinfoResponse>("UserinfoResponse")({
  sub:     Schema.String,
  name:    Schema.optional(Schema.String),
  picture: Schema.optional(Schema.String),
  email:   Schema.optional(Schema.String),
}) {}

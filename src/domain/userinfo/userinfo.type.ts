import { Schema } from "effect"

export const UserinfoResponse = Schema.Struct({
  sub:     Schema.String,
  name:    Schema.optional(Schema.String),
  picture: Schema.optional(Schema.String),
  email:   Schema.optional(Schema.String),
})
export type UserinfoResponse = Schema.Schema.Type<typeof UserinfoResponse>

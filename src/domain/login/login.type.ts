import { Schema } from "effect"

export const QrQuery = Schema.Struct({
  session_id: Schema.String,
  client_id:  Schema.String,
})
export type QrQuery = Schema.Schema.Type<typeof QrQuery>

export const PollQuery = Schema.Struct({
  session_id: Schema.String,
})
export type PollQuery = Schema.Schema.Type<typeof PollQuery>

export const QrResponse = Schema.Struct({
  status:  Schema.Number,
  message: Schema.optional(Schema.String),
  data:    Schema.optional(Schema.Struct({
    session_id: Schema.String,
    qr_url:     Schema.String,
    expires_in: Schema.Number,
  })),
})
export type QrResponse = Schema.Schema.Type<typeof QrResponse>

export const PollResponse = Schema.Struct({
  status:  Schema.Number,
  message: Schema.optional(Schema.String),
  data:    Schema.optional(Schema.Struct({
    status:  Schema.String,
    user_id: Schema.optional(Schema.String),
  })),
})
export type PollResponse = Schema.Schema.Type<typeof PollResponse>

import { Schema } from "effect"
import { HttpServerResponse } from "effect/unstable/http"

export const ApiResponse = <A>(dataSchema: Schema.Schema<A>) =>
  Schema.Struct({
    status:  Schema.Number,
    message: Schema.optional(Schema.String),
    data:    Schema.optional(dataSchema),
  })

export const ApiListResponse = <A>(dataSchema: Schema.Schema<A>) =>
  Schema.Struct({
    status:  Schema.Number,
    message: Schema.optional(Schema.String),
    data:    Schema.optional(Schema.Array(dataSchema)),
  })

export type ApiResponse<A> = {
  readonly status:   number
  readonly message?: string
  readonly data?:    A
}

export const apiOk = <A>(data: A, message?: string): ApiResponse<A> => ({
  status: 200,
  message,
  data,
})

export const apiCreated = <A>(data: A, message?: string): ApiResponse<A> => ({
  status: 201,
  message,
  data,
})

export const apiError = <A = never>(status: number, message: string, data?: A): ApiResponse<A> => ({
  status,
  message,
  data,
})

export const httpError = <A = never>(status: number, message: string, data?: A) =>
  HttpServerResponse.json({ status, message, data } satisfies ApiResponse<A | undefined>, { status })

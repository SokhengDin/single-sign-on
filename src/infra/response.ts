import { Data, Effect, Schema } from "effect"
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

export class HttpErrorResponse extends Data.TaggedError("HttpErrorResponse")<{
  readonly response: HttpServerResponse.HttpServerResponse
}> {}

export const httpError = (status: number, message: string) =>
  Effect.fail(
    new HttpErrorResponse({
      response: HttpServerResponse.jsonUnsafe({ status, message, data: null }, { status }),
    })
  )

export const unwrapHttpErrors = <A, E, R>(
  effect: Effect.Effect<A, E | HttpErrorResponse, R>
): Effect.Effect<A | HttpServerResponse.HttpServerResponse, Exclude<E, HttpErrorResponse>, R> =>
  effect.pipe(
    Effect.catchTag("HttpErrorResponse", (e) => Effect.succeed((e as HttpErrorResponse).response))
  ) as Effect.Effect<A | HttpServerResponse.HttpServerResponse, Exclude<E, HttpErrorResponse>, R>

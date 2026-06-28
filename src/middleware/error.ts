import { Cause, Effect, Exit } from "effect"
import { HttpMiddleware, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

function errorBody(status: number, message: string) {
  return { status, message, data: null }
}

function extractMessage(err: unknown): string {
  if (err === null || err === undefined) return "Internal server error"
  if (err instanceof Error) {
    const nested = (err as any).cause
    if (nested instanceof Error) return nested.message
    return err.message
  }
  if (typeof err === "object") {
    const e = err as Record<string, unknown>
    const nested = e["cause"]
    if (nested instanceof Error) return (nested as Error).message
    if (typeof e["message"] === "string") return e["message"]
    if (typeof e["_tag"] === "string") return e["_tag"] as string
  }
  return String(err)
}

function causeToResponse(cause: Cause.Cause<unknown>, method: string): HttpServerResponse.HttpServerResponse {
  for (const reason of cause.reasons) {
    if (reason._tag === "Die") {
      const d = (reason as any).defect
      if (d !== null && typeof d === "object" && d.status === 404) {
        return HttpServerResponse.jsonUnsafe(
          errorBody(405, `Method ${method} not allowed`),
          { status: 405 }
        )
      }
    }
    if (reason._tag === "Fail") {
      const e = (reason as any).error
      if (e !== null && typeof e === "object") {
        if (e._tag === "HttpApiDecodeError" || e._tag === "ParseError") {
          return HttpServerResponse.jsonUnsafe(errorBody(422, "Validation failed"), { status: 422 })
        }
        if (e._tag === "DatabaseError") {
          return HttpServerResponse.jsonUnsafe(errorBody(500, extractMessage(e)), { status: 500 })
        }
        if (typeof e._tag === "string") {
          const message = typeof e.message === "string" ? e.message : String(e._tag)
          return HttpServerResponse.jsonUnsafe(errorBody(400, message), { status: 400 })
        }
        if (e instanceof Error) {
          return HttpServerResponse.jsonUnsafe(errorBody(500, e.message), { status: 500 })
        }
      }
    }
  }
  return HttpServerResponse.jsonUnsafe(errorBody(500, "Internal server error"), { status: 500 })
}

export const errorHandler = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const req    = yield* HttpServerRequest.HttpServerRequest
    const method = req.method
    const url    = req.url

    const exit = yield* Effect.exit(app)

    if (Exit.isSuccess(exit)) {
      const res = exit.value
      if (res.status >= 400) {
        const body = res.body
        if (body._tag !== "Empty") {
          yield* Effect.logWarning(`← ${method} ${url} ${res.status}`)
          return res
        }
        yield* Effect.logWarning(`← ${method} ${url} ${res.status} [empty body]`)
        const status  = res.status
        const message = status >= 500 ? "Internal server error" : "Request failed"
        return HttpServerResponse.jsonUnsafe(errorBody(status, message), { status })
      }
      return res
    }

    const response = causeToResponse(exit.cause, method)
    yield* Effect.logError(`← ${method} ${url} ${response.status} [error]`, exit.cause)
    return response
  })
)

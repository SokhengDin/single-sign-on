import { Effect, Exit } from "effect"
import { HttpMiddleware, HttpServerRequest } from "effect/unstable/http"

export const httpLogger = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const req    = yield* HttpServerRequest.HttpServerRequest
    const start  = Date.now()
    const method = req.method
    const url    = req.url
    const ip     = req.remoteAddress._tag === "Some" ? req.remoteAddress.value : "-"

    yield* Effect.logInfo(`→ ${method} ${url} [${ip}]`)

    const exit = yield* Effect.exit(app)
    const ms   = Date.now() - start

    if (Exit.isSuccess(exit)) {
      yield* Effect.logInfo(`← ${method} ${url} ${exit.value.status} ${ms}ms [${ip}]`)
      return exit.value
    }

    yield* Effect.logError(`← ${method} ${url} ${ms}ms [${ip}]`, exit.cause)
    return yield* Effect.failCause(exit.cause)
  })
)

import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Config, Layer } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiSwagger, OpenApi } from "effect/unstable/httpapi"
import { HttpRouter } from "effect/unstable/http"
import { AppConfig } from "./src/config/index.ts"
import { SqlLive } from "./src/infra/sql.ts"
import { LoggerLive } from "./src/infra/logger.ts"
import { CryptoService } from "./src/infra/crypto.ts"
import { JoseService } from "./src/infra/jose.ts"
import { UserApi, UserHandlers } from "./src/domain/user/user.http.ts"
import { AccountApi, AccountHandlers } from "./src/domain/account/account.http.ts"
import { ClientApi, ClientHandlers } from "./src/domain/client/client.http.ts"
import { OAuthApi, AuthorizationHandlers } from "./src/domain/authorization/authorization.http.ts"
import { VerificationApi, VerificationHandlers } from "./src/domain/verification/verification.http.ts"
import { WellKnownApi, WellKnownHandlers } from "./src/well-known/well-known.http.ts"
import { KeysApi, KeysHandlers } from "./src/domain/keys/keys.http.ts"
import { LinkingApi, LinkingHandlers } from "./src/domain/linking/linking.http.ts"
import { httpLogger } from "./src/middleware/logger.ts"
import { errorHandler } from "./src/middleware/error.ts"


const RootApi =  HttpApi.make("sso-api")
  .addHttpApi(UserApi)
  .addHttpApi(AccountApi)
  .addHttpApi(ClientApi)
  .addHttpApi(OAuthApi)
  .addHttpApi(VerificationApi)
  .addHttpApi(WellKnownApi)
  .addHttpApi(KeysApi)
  .addHttpApi(LinkingApi)
  .annotateMerge(OpenApi.annotations({ title: "SSO Identity Provider API" }))
{}

const InfraLayer = Layer.mergeAll(
  SqlLive,
  AppConfig.layer,
  CryptoService.layer,
  JoseService.layer,
)

const ApiLayer = Layer.mergeAll(
  HttpApiBuilder.layer(UserApi).pipe(Layer.provide(UserHandlers)),
  HttpApiBuilder.layer(AccountApi).pipe(Layer.provide(AccountHandlers)),
  HttpApiBuilder.layer(ClientApi).pipe(Layer.provide(ClientHandlers)),
  HttpApiBuilder.layer(OAuthApi).pipe(Layer.provide(AuthorizationHandlers)),
  HttpApiBuilder.layer(VerificationApi).pipe(Layer.provide(VerificationHandlers)),
  HttpApiBuilder.layer(WellKnownApi).pipe(Layer.provide(WellKnownHandlers)),
  HttpApiBuilder.layer(KeysApi).pipe(Layer.provide(KeysHandlers)),
  HttpApiBuilder.layer(LinkingApi).pipe(Layer.provide(LinkingHandlers)),
).pipe(Layer.provide(InfraLayer))

const AllRoutes = Layer.mergeAll(
  ApiLayer,
  HttpApiSwagger.layer(RootApi, { path: "/docs" }),
)

const middleware = (app: Parameters<typeof httpLogger>[0]) => errorHandler(httpLogger(app))

const HttpServerLayer = HttpRouter.serve(AllRoutes, {
	middleware, disableLogger: true
}).pipe(
  Layer.provide(
    BunHttpServer.layerConfig({
      port: Config.withDefault(Config.int("PORT"), 3004),
    })
  ),
  Layer.provide(InfraLayer)
)

BunRuntime.runMain(Layer.launch(Layer.mergeAll(HttpServerLayer, LoggerLive))) as any

import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Config, Layer } from "effect"
import { HttpApi, HttpApiBuilder, HttpApiSwagger, OpenApi } from "effect/unstable/httpapi"
import { HttpRouter } from "effect/unstable/http"
import { AppConfig } from "@/config/index.ts"
import { SqlLive } from "@/infra/sql.ts"
import { LoggerLive } from "@/infra/logger.ts"
import { CryptoService } from "@/infra/crypto.ts"
import { JoseService } from "@/infra/jose.ts"
import { UserApi, UserHandlers } from "@/domain/user/user.http.ts"
import { AccountApi, AccountHandlers } from "@/domain/account/account.http.ts"
import { ClientApi, ClientHandlers } from "@/domain/client/client.http.ts"
import { OAuthApi, AuthorizationHandlers } from "@/domain/authorization/authorization.http.ts"
import { VerificationApi, VerificationHandlers } from "@/domain/verification/verification.http.ts"
import { WellKnownApi, WellKnownHandlers } from "@/well-known/well-known.http.ts"

class SsoApi extends HttpApi.make("sso-api")
  .addHttpApi(UserApi)
  .addHttpApi(AccountApi)
  .addHttpApi(ClientApi)
  .addHttpApi(OAuthApi)
  .addHttpApi(VerificationApi)
  .addHttpApi(WellKnownApi)
  .annotateMerge(OpenApi.annotations({ title: "SSO Identity Provider API" }))
{}

const InfraLayer = Layer.mergeAll(
  SqlLive,
  AppConfig.layer,
  CryptoService.layer,
  JoseService.layer,
)

const ApiRoutes = Layer.mergeAll(
  HttpApiBuilder.layer(UserApi).pipe(Layer.provide(UserHandlers)),
  HttpApiBuilder.layer(AccountApi).pipe(Layer.provide(AccountHandlers)),
  HttpApiBuilder.layer(ClientApi).pipe(Layer.provide(ClientHandlers)),
  HttpApiBuilder.layer(OAuthApi).pipe(Layer.provide(AuthorizationHandlers)),
  HttpApiBuilder.layer(VerificationApi).pipe(Layer.provide(VerificationHandlers)),
  HttpApiBuilder.layer(WellKnownApi).pipe(Layer.provide(WellKnownHandlers)),
).pipe(Layer.provide(InfraLayer))

const AllRoutes = Layer.mergeAll(
  ApiRoutes,
  HttpApiSwagger.layer(SsoApi, { path: "/docs" }),
)

const ServerLayer = HttpRouter.serve(AllRoutes).pipe(
  Layer.provide(
    BunHttpServer.layerConfig({
      port: Config.withDefault(Config.int("PORT"), 3004),
    })
  ),
  Layer.provide(InfraLayer)
)

Layer.launch(Layer.mergeAll(ServerLayer, LoggerLive)).pipe(BunRuntime.runMain)

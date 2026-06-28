import { Config, Context, Effect, Layer } from "effect"

export interface AppConfigService {
  readonly dbHost:            string
  readonly dbPort:            number
  readonly dbUser:            string
  readonly dbPassword:        string
  readonly dbName:            string
  readonly dbSslMode:         string
  readonly appUrl:            string
  readonly appEnv:            string
  readonly appPort:           number
  readonly signingKeySecret:  string
}

export class AppConfig extends Context.Service<AppConfig, AppConfigService>()("sso/AppConfig") {
  static readonly layer = Layer.effect(
    AppConfig,
    Effect.gen(function* () {
      const dbHost           = yield* Config.string("DB_HOST")
      const dbPort           = yield* Config.int("DB_PORT")
      const dbUser           = yield* Config.string("DB_USER")
      const dbPassword       = yield* Config.string("DB_PASSWORD")
      const dbName           = yield* Config.string("DB_NAME")
      const dbSslMode        = yield* Config.string("DB_SSLMODE")
      const appUrl           = yield* Config.string("APP_URL")
      const appEnv           = yield* Config.withDefault(Config.string("APP_ENV"), "development")
      const appPort          = yield* Config.withDefault(Config.int("APP_PORT"), 3005)
      const signingKeySecret = yield* Config.string("SIGNING_KEY_ENCRYPTION_SECRET")

      return AppConfig.of({
        dbHost, dbPort, dbUser, dbPassword, dbName, dbSslMode,
        appUrl, appEnv, appPort, signingKeySecret,
      })
    })
  )
}

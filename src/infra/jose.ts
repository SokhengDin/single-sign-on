import { Context, Effect, Layer, Schema } from "effect"
import {
  exportJWK,
  exportPKCS8,
  exportSPKI,
  generateKeyPair,
  importPKCS8,
  importSPKI,
  jwtVerify,
  SignJWT,
  type JWTPayload,
} from "jose"

export class JwtSignError extends Schema.TaggedErrorClass<JwtSignError>()("JwtSignError", { cause: Schema.Defect() }) {}
export class JwtVerifyError extends Schema.TaggedErrorClass<JwtVerifyError>()("JwtVerifyError", { cause: Schema.Defect() }) {}
export class KeyGenError extends Schema.TaggedErrorClass<KeyGenError>()("KeyGenError", { cause: Schema.Defect() }) {}
export class KeyImportError extends Schema.TaggedErrorClass<KeyImportError>()("KeyImportError", { cause: Schema.Defect() }) {}

export interface IdTokenClaims extends JWTPayload {
  sub:      string
  iss:      string
  aud:      string
  nonce?:   string
  name?:    string
  picture?: string
}

export interface GeneratedKeyPair {
  kid:        string
  algorithm:  string
  privatePem: string
  publicPem:  string
  publicJwk:  Record<string, unknown>
}

export interface ActiveSigningKey {
  kid:        string
  algorithm:  string
  privateKey: CryptoKey
}

export interface PublicJwk {
  kid: string
  use: string
  [key: string]: unknown
}

export class JoseService extends Context.Service<JoseService, {
  generateKeyPair(kid: string, algorithm: string): Effect.Effect<GeneratedKeyPair, KeyGenError>
  importPrivateKey(pem: string, algorithm: string): Effect.Effect<CryptoKey, KeyImportError>
  importPublicKey(pem: string, algorithm: string): Effect.Effect<CryptoKey, KeyImportError>
  signIdToken(claims: IdTokenClaims, key: ActiveSigningKey, expiresIn: string): Effect.Effect<string, JwtSignError>
  verifyToken(token: string, publicKey: CryptoKey): Effect.Effect<JWTPayload, JwtVerifyError>
  publicKeyToJwk(pem: string, algorithm: string, kid: string): Effect.Effect<PublicJwk, KeyImportError>
}>()("sso/infra/JoseService") {
  static readonly layer = Layer.effect(
    JoseService,
    Effect.gen(function* () {
      const generateKeyPairFn = Effect.fn("JoseService.generateKeyPair")(function* (kid: string, algorithm: string) {
        return yield* Effect.tryPromise({
          try: async () => {
            const alg = algorithm.startsWith("RS") ? "RSA-PSS" : "EC"
            const crv = algorithm === "ES256" ? "P-256" : algorithm === "ES384" ? "P-384" : undefined
            const params = alg === "EC" ? { crv } : { modulusLength: 2048 }
            const { privateKey, publicKey } = await generateKeyPair(alg, params as Parameters<typeof generateKeyPair>[1])
            const privatePem = await exportPKCS8(privateKey)
            const publicPem  = await exportSPKI(publicKey)
            const jwk        = await exportJWK(publicKey)
            return {
              kid,
              algorithm,
              privatePem,
              publicPem,
              publicJwk: { ...jwk, kid, use: "sig", alg: algorithm },
            } satisfies GeneratedKeyPair
          },
          catch: (cause) => new KeyGenError({ cause })
        })
      })

      const importPrivateKeyFn = Effect.fn("JoseService.importPrivateKey")(function* (pem: string, algorithm: string) {
        return yield* Effect.tryPromise({
          try: () => importPKCS8(pem, algorithm) as Promise<CryptoKey>,
          catch: (cause) => new KeyImportError({ cause })
        })
      })

      const importPublicKeyFn = Effect.fn("JoseService.importPublicKey")(function* (pem: string, algorithm: string) {
        return yield* Effect.tryPromise({
          try: () => importSPKI(pem, algorithm) as Promise<CryptoKey>,
          catch: (cause) => new KeyImportError({ cause })
        })
      })

      const signIdToken = Effect.fn("JoseService.signIdToken")(function* (
        claims: IdTokenClaims,
        key: ActiveSigningKey,
        expiresIn: string
      ) {
        return yield* Effect.tryPromise({
          try: () =>
            new SignJWT(claims)
              .setProtectedHeader({ alg: key.algorithm, kid: key.kid })
              .setIssuedAt()
              .setExpirationTime(expiresIn)
              .sign(key.privateKey),
          catch: (cause) => new JwtSignError({ cause })
        })
      })

      const verifyToken = Effect.fn("JoseService.verifyToken")(function* (token: string, publicKey: CryptoKey) {
        return yield* Effect.tryPromise({
          try: async () => {
            const { payload } = await jwtVerify(token, publicKey)
            return payload
          },
          catch: (cause) => new JwtVerifyError({ cause })
        })
      })

      const publicKeyToJwk = Effect.fn("JoseService.publicKeyToJwk")(function* (pem: string, algorithm: string, kid: string) {
        return yield* Effect.tryPromise({
          try: async () => {
            const key = await importSPKI(pem, algorithm)
            const jwk = await exportJWK(key)
            return { ...jwk, kid, use: "sig", alg: algorithm } as PublicJwk
          },
          catch: (cause) => new KeyImportError({ cause })
        })
      })

      return JoseService.of({
        generateKeyPair:  generateKeyPairFn,
        importPrivateKey: importPrivateKeyFn,
        importPublicKey:  importPublicKeyFn,
        signIdToken,
        verifyToken,
        publicKeyToJwk,
      })
    })
  )
}

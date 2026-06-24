import { Context, Effect, Layer, Schema } from "effect"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

export class PKCEVerifyError extends Schema.TaggedErrorClass<PKCEVerifyError>()("PKCEVerifyError", {}) {}
export class EncryptError extends Schema.TaggedErrorClass<EncryptError>()("EncryptError", { cause: Schema.Defect() }) {}
export class DecryptError extends Schema.TaggedErrorClass<DecryptError>()("DecryptError", { cause: Schema.Defect() }) {}

export class CryptoService extends Context.Service<CryptoService, {
  generateToken(): 			Effect.Effect<string>
  sha256(raw: string): 	Effect.Effect<string>
  verifyPKCE(verifier: 	string, challenge: string): Effect.Effect<void, PKCEVerifyError>
  encrypt(plaintext: 		string, secret: string): Effect.Effect<string, EncryptError>
  decrypt(ciphertext: 	string, secret: string): Effect.Effect<string, DecryptError>
}>()("sso/infra/CryptoService") {
  static readonly layer = Layer.effect(
    CryptoService,
    Effect.gen(function* () {
			
      const generateToken = Effect.fn("CryptoService.generateToken")(function* () {
        return yield* Effect.sync(() => randomBytes(32).toString("hex"))
      })

      const sha256 = Effect.fn("CryptoService.sha256")(function* (raw: string) {
        return yield* Effect.sync(() =>
          createHash("sha256").update(raw).digest("hex")
        )
      })

      const verifyPKCE = Effect.fn("CryptoService.verifyPKCE")(function* (verifier: string, challenge: string) {
        const computed = yield* Effect.sync(() =>
          createHash("sha256").update(verifier).digest("base64url")
        )
        if (computed !== challenge) return yield* new PKCEVerifyError()
      })

      const encrypt = Effect.fn("CryptoService.encrypt")(function* (plaintext: string, secret: string) {
        return yield* Effect.try({
          try: () => {
            const key = createHash("sha256").update(secret).digest()
            const iv  = randomBytes(12)
            const cipher = createCipheriv("aes-256-gcm", key, iv)
            const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
            const tag = cipher.getAuthTag()
            return Buffer.concat([iv, tag, encrypted]).toString("base64")
          },
          catch: (cause) => new EncryptError({ cause })
        })
      })

      const decrypt = Effect.fn("CryptoService.decrypt")(function* (ciphertext: string, secret: string) {
        return yield* Effect.try({
          try: () => {
            const key  = createHash("sha256").update(secret).digest()
            const buf  = Buffer.from(ciphertext, "base64")
            const iv   = buf.subarray(0, 12)
            const tag  = buf.subarray(12, 28)
            const data = buf.subarray(28)
            const decipher = createDecipheriv("aes-256-gcm", key, iv)
            decipher.setAuthTag(tag)
            return decipher.update(data) + decipher.final("utf8")
          },
          catch: (cause) => new DecryptError({ cause })
        })
      })

      return CryptoService.of({ generateToken, sha256, verifyPKCE, encrypt, decrypt })
    })
  )
}

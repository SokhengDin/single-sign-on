import { Effect, Layer, Logger } from "effect";
import { BunFileSystem } from "@effect/platform-bun";
import { mkdirSync } from "node:fs"
import { join } from "node:path"

const LOGS_DIR        = join(import.meta.dir, "../../logs")
const RETENTION_DAYS  = 7

function todayPath(): string {
	const d = new Date()
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, "0")
	const day = String(d.getDate()).padStart(2, "0")
	return join(LOGS_DIR, `app-${y}-${m}-${day}.log`)
}

function purgeOlLogs(): void {
	const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
	try {
		const { readdirSync, statSync, unlinkSync } = require("node:fs") as typeof import("node:fs")
		for (const f of readdirSync(LOGS_DIR)) {
			if (!f.startsWith("app-") || !f.endsWith(".log")) continue
			const full = join(LOGS_DIR, f)
			if (statSync(full).mtimeMs < cutoff) unlinkSync(full)
		}
	} catch {}
}

const makeFileLogger = Effect.gen(
	function* () {
		mkdirSync(LOGS_DIR, {recursive: true})
		purgeOlLogs()
		return yield* Logger.formatJson.pipe(
			Logger.toFile(
				todayPath(),
				{ flag: "a" }
			)
		)
	}
)

process.env["FORCE_COLOR"] = "1"

export const LoggerLive = Logger.layer([
	Logger.consolePretty({ colors: true }),
	makeFileLogger,
]).pipe(
	Layer.provide(BunFileSystem.layer)
)
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG APP_PORT=3005
EXPOSE ${APP_PORT}

CMD ["bun", "run", "index.ts"]

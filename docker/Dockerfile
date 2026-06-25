FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/
COPY packages/core/package.json ./packages/core/
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY . .
RUN node scripts/generate-version.mjs
RUN pnpm --filter @parawrite/core build
RUN pnpm --filter @parawrite/web build
RUN pnpm --filter @parawrite/server build

FROM node:22-alpine AS runner
RUN apk add --no-cache wget
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/core/package.json ./packages/core/
COPY --from=build /app/config/parawrite.example.yaml ./config/parawrite.example.yaml

EXPOSE 8787
CMD ["node", "apps/server/dist/index.js"]

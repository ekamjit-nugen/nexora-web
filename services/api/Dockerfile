# syntax=docker/dockerfile:1
# =============================================================================
# Single Docker image for the entire Nexora API monolith.
#
# Replaces 18 separate Dockerfiles. Each module's code lives in src/modules/<name>
# and is loaded into the same Nest application. To extract any single module
# back to its own service, build with --target=<module> and override CMD to
# run that module's bootstrap.ts (the per-module bootstrap entry is the
# "split lever" we keep ready in every module).
# =============================================================================

FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json nest-cli.json ./
COPY src ./src

RUN npm run build

# -----------------------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

# wget for the docker-compose healthcheck. Tiny, no harm.
RUN apk add --no-cache wget

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Default entrypoint = the full monolith. Override CMD when you split a
# module out (e.g. `node dist/src/modules/payroll/payroll.bootstrap.js`).
CMD ["node", "dist/src/main.js"]

# Multi-stage production Dockerfile for @nimu/api
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat openssl

# Copy root workspace configurations
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

# Install dependencies across workspaces
RUN npm ci

# Copy sources
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared package
RUN npm run build --workspace=@nimu/shared

# Generate Prisma client and build API TypeScript
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# Stage 2: Minimal Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl dumb-init curl

ENV NODE_ENV=production
ENV PORT=4000

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nimu

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package*.json ./packages/shared/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/package*.json ./apps/api/

USER nimu

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/healthz || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "apps/api/dist/server.js"]

# Multi-stage production Dockerfile for @nimu/web
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace configurations
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/web/package*.json ./apps/web/

RUN npm ci

# Copy source
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build shared package then web SPA
RUN npm run build --workspace=@nimu/shared
RUN npm run build --workspace=@nimu/web

# Stage 2: Nginx Web Server
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

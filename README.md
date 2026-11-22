# Nimu — Your little space for everything.

> A cozy personal workspace that combines a rich-text notes app, a digital sticky-note board, a drawing canvas, and a personal expense tracker.

---

## Architecture Overview

Nimu is organized as a high-performance TypeScript monorepo:

- **`apps/web`**: React 18, TypeScript, Vite, Tailwind CSS, Zustand, Framer Motion, Recharts, Lucide React.
- **`apps/api`**: Node.js 20+, Fastify, PostgreSQL 16 with Prisma ORM, Argon2id auth with rotating refresh tokens, Zod validation, Pino structured logging, OpenAPI 3 swagger docs.
- **`packages/shared`**: Shared Zod schemas, TypeScript contracts, palettes, and constants.

```
nimu/
├── apps/
│   ├── web/          # React + Vite frontend
│   └── api/          # Fastify + Prisma + PostgreSQL backend
├── packages/
│   └── shared/       # Shared Zod schemas, types & constants
├── docker-compose.yml # PostgreSQL, Redis, MinIO
└── .github/          # CI Pipeline
```

---

## Entity Relationship Overview

```mermaid
erDiagram
    User ||--o| Preferences : has
    User ||--o{ Session : maintains
    User ||--o{ CustomTheme : creates
    User ||--o{ Collection : organizes
    User ||--o{ Tag : creates
    User ||--o{ Note : writes
    User ||--o{ StickyBoard : owns
    StickyBoard ||--o{ StickyNote : contains
    User ||--o{ Drawing : paints
    User ||--o{ Transaction : records
    User ||--o{ Budget : plans
    Budget ||--o{ CategoryBudget : allocates
    User ||--o{ SavingsGoal : sets
    SavingsGoal ||--o{ GoalContribution : accumulates
    User ||--o{ AuditLog : logs
```

---

## Quickstart (Under 5 Commands)

```bash
# 1. Install all dependencies across monorepo
npm install

# 2. Start PostgreSQL, Redis, and MinIO in Docker
docker compose up -d

# 3. Setup environment and push database schema
cp .env.example .env
npm run prisma:push --workspace=@nimu/api

# 4. Start frontend and backend concurrently
npm run dev
```

- **Web Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:4000](http://localhost:4000)
- **OpenAPI Docs**: [http://localhost:4000/docs](http://localhost:4000/docs)
- **Health Checks**: [http://localhost:4000/healthz](http://localhost:4000/healthz)

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | API server port | `4000` |
| `DATABASE_URL` | PostgreSQL 16 connection URL | `postgresql://nimu:nimupassword@localhost:5432/nimu_dev?schema=public` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | Secret key for signing access tokens | Minimum 32 characters |
| `JWT_REFRESH_SECRET` | Secret key for rotating refresh tokens | Minimum 32 characters |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifespan | `15m` |
| `JWT_REFRESH_EXPIRES_IN_DAYS` | Refresh token lifespan | `30` |
| `S3_ENDPOINT` | MinIO or S3 endpoint | `http://localhost:9000` |
| `S3_BUCKET` | Assets bucket | `nimu-assets` |

---

## Security Model

- **Argon2id Hashing**: Passwords are saved with high-memory Argon2id (`m=65536, t=3, p=1`).
- **Rotating Refresh Tokens**: Refresh tokens rotate on every `/auth/refresh` call. Replay or reuse of a revoked token triggers instant family revocation across all active sessions.
- **Strict Isolation**: Every resource query is strictly scoped by `userId`.
- **Zero-trust validation**: Every route validates payload and query parameters with Zod.

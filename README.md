# Nimu — Your little space for everything. 🌿

> A warm, cozy personal workspace combining a rich-text notes app, a digital sticky-note board, a vector drawing canvas, and an intentional personal finance tracker.

[![CI](https://github.com/ayumadeit/Nimu/actions/workflows/ci.yml/badge.svg)](https://github.com/ayumadeit/Nimu/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

---

## 🏛️ Architecture Overview

Nimu is crafted as a high-performance, strictly-typed TypeScript monorepo designed for long-term maintainability, security, and delightful user experience:

```
nimu/
├── apps/
│   ├── web/               # React 18 + Vite SPA, Tailwind CSS, Zustand, Recharts, Framer Motion
│   └── api/               # Fastify 4, PostgreSQL 16, Prisma ORM, Argon2id, Zod, OpenAPI 3
├── packages/
│   └── shared/            # Shared Zod validation schemas, TypeScript DTOs, theme palettes, tokens
├── docker-compose.yml      # Local dev services (PostgreSQL 16, Redis 7, MinIO S3)
└── .github/workflows/ci.yml # Automated lint, type-check, test, and build CI
```

- **`apps/web`**: Instant, zero-latency UI powered by Vite and Zustand with persistent local caching, fluid Framer Motion animations, interactive SVG drawing canvas, and Recharts financial analytics.
- **`apps/api`**: Fastify 4 HTTP backend running Node 20+, Argon2id password hashing, rotating refresh tokens with token-family replay revocation, Prisma ORM with PostgreSQL, rate-limiting, Helmet security headers, and automated OpenAPI 3 docs at `/docs`.
- **`packages/shared`**: Single source of truth for database DTOs, API contracts, input schemas, and cozy color palettes shared seamlessly across client and server.

---

## ✨ Features Across All Rooms

### 1. 📝 My Notes (Distraction-Free Sanctuary)
- TipTap ProseMirror-based structured rich text editor with Markdown shortcut support.
- Server-side ProseMirror schema sanitization (strips malicious script/iframe tags).
- Auto-derived metadata: plain text extraction, word counts, and reading time estimation.
- Collections hierarchy and multi-tag filtering.
- Optimistic autosave with `version` field conflict detection (409 Conflict with server payload).
- Revision history with snapshot tracking and instant rollback.
- Anti-SSRF protected external media embedding (blocks private IP ranges, cloud metadata endpoints, loopback).

### 2. 📌 Sticky Board (Playful Thinking Space)
- Infinite corkboard canvas with freeform drag-and-drop powered by Framer Motion.
- Authentic pastel color palette with randomized micro-rotations (`-4°` to `+4°`).
- Safe z-index layering with `bring-to-front` and `send-to-back` actions.
- Batch position updates (up to 100 stickies) with debounced autosave.
- "Pin to Dashboard" feature to keep urgent reminders visible on your home screen.

### 3. 🎨 Drawing Canvas (Cozy Sketching)
- Freehand vector drawing engine capturing precise smooth coordinate paths.
- Tools: Fountain Pen, Soft Highlighter, Precision Eraser, and Color Picker.
- Paper textures: Plain, Dotted Grid, Lined Notebook, and Isometric Grid.
- Vector JSON stroke storage and high-resolution PNG export.

### 4. 👛 Finance & Budgets (Mindful Money Tracking)
- Strict minor integer units (paise) math across the entire stack—never floating-point errors.
- Fast transaction entry with idempotency keys (`X-Idempotency-Key`) preventing double-billing on mobile connections.
- Grouped daily transactions and 14-day spending timeline.
- Monthly budgets with category-level limits and visual threshold warnings (80% amber warning, 100% exceeded red alert).
- Savings Goals with visual progress cards and deposit/withdrawal milestone logs.

### 5. 📊 Insights & Analytics
- Monthly financial overview with month-over-month percentage change comparison.
- 6-month historical income vs. expense area trend charts.
- Category spending distribution donut and bar charts.
- Day-by-day zero-filled monthly spending pattern graphs.
- 60-second in-memory performance caching on high-frequency analytics endpoints.

### 6. 🔍 Command Palette & Global Search (`⌘K` / `Ctrl+K`)
- Omnipresent command palette accessible from any screen with keyboard shortcut `⌘K` or header button.
- Multi-entity live search querying Notes, Stickies, and Transactions simultaneously.
- Keyboard navigation (arrows `↑`/`↓`, `Enter` to jump, `Esc` to dismiss).
- Quick navigation shortcuts to instantly jump between all rooms.

### 7. 📦 Radical Data Portability & Local Storage Migration
- **Export Notes as Markdown**: Individual notes formatted with standard YAML frontmatter metadata ready for Obsidian, Logseq, or Bear.
- **Export Transactions as CSV**: Clean comma-separated spreadsheet with dates, categories, payment methods, and rupee amounts.
- **Complete Backup**: Full JSON backup containing notes, stickies, drawings, transactions, budgets, and themes.
- **"Bring My Data Along"**: Zero-data-loss idempotent migration from browser `localStorage` (`nimu-state-v1`) into PostgreSQL with duplicate prevention.

---

## 🚀 Quickstart (Under 5 Commands)

### Prerequisites
- Node.js `20.x` or higher
- Docker & Docker Compose (or local PostgreSQL 16)

```bash
# 1. Clone repository and install dependencies
git clone https://github.com/ayumadeit/Nimu.git
cd Nimu
npm install

# 2. Start PostgreSQL 16, Redis, and MinIO in Docker
docker compose up -d

# 3. Setup environment variables and push schema
cp .env.example .env
npm run prisma:push --workspace=@nimu/api

# 4. Seed database with rich realistic demo data (~40 notes, 12 stickies, 280 transactions)
npm run seed --workspace=@nimu/api

# 5. Start both Frontend and Backend concurrently
npm run dev
```

- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:4000](http://localhost:4000)
- **Interactive OpenAPI Documentation**: [http://localhost:4000/docs](http://localhost:4000/docs)
- **Health Check Endpoint**: [http://localhost:4000/healthz](http://localhost:4000/healthz)

### 🔑 Demo Account Credentials
- **Email**: `demo@nimu.app`
- **Password**: `NimuCozy#2026!`

---

## 🧪 Testing Suite

Nimu includes comprehensive unit and integration test suites powered by Vitest, verifying authentication, concurrency, sanitization, SSRF protection, analytics, search, and migration:

```bash
# Run all tests across the monorepo
npm run test

# Run tests in watch mode
npm run test --workspace=@nimu/api -- --watch
```

---

## 🛡️ Security Model

- **Argon2id Password Hashing**: Uses high-memory parameters (`memoryCost: 65536`, `timeCost: 3`, `parallelism: 4`) recommended by OWASP.
- **Rotating Refresh Tokens & Replay Detection**: HttpOnly cookies with cryptographic rotation. If a previously-used token is replayed, the entire session family is instantly revoked.
- **SSRF Prevention**: URL validation blocks private IPv4/IPv6 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.169.254`).
- **Content Sanitization**: ProseMirror JSON nodes are rigorously filtered against an explicit element whitelist.
- **Tenant Isolation**: Every database query strictly filters by authenticated `userId`.
- **Retention & Cleanup**: Automated retention jobs (`apps/api/src/lib/cleanup.ts`) purge 30-day soft-deleted entities and unattached assets.

---

## 🚢 Deployment

### Production Build
```bash
npm run build
```
Builds `@nimu/shared` with `tsup`, `@nimu/api` with `tsc`, and `@nimu/web` with Vite production minification and chunk optimization.

### Deploying the Backend (Railway / Render / Fly.io / Docker)
A standard Dockerfile or container runner can build and run `apps/api`:
```bash
docker build -t nimu-api -f apps/api/Dockerfile .
docker run -p 4000:4000 --env-file .env nimu-api
```

### Deploying the Frontend (Vercel / Cloudflare Pages / Netlify)
Set root directory to `apps/web` or run:
- Build command: `npm run build:shared && npm run build:web`
- Output directory: `apps/web/dist`
- Environment variable: `VITE_API_URL=https://api.yourdomain.com/api/v1`

---

## 📄 License

MIT © Ayush & Nimu Contributors. Built with care for quiet minds.

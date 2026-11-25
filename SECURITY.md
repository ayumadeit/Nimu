# Security Model & Data Protections — Nimu 🛡️

Nimu is designed with defense-in-depth principles to ensure that personal thoughts, financial numbers, drawings, and session credentials remain strictly confidential, tamper-proof, and private.

---

## 1. Authentication & Session Security

- **Password Hashing (Argon2id)**:
  - Memory cost: 64 MB (`m=65536`)
  - Time cost: 3 iterations (`t=3`)
  - Parallelism: 4 threads (`p=4`)
  - Compliant with OWASP Password Storage Guidelines. Common and breached passwords are fundamentally rejected.
- **Short-Lived Access Tokens**:
  - Signed via EdDSA / HMAC-SHA256 (`JWT_ACCESS_SECRET`) with a strictly enforced 15-minute lifespan.
- **Rotating Refresh Tokens with Replay Detection**:
  - 384-bit cryptographically secure random tokens transmitted via `httpOnly`, `Secure`, `SameSite=Lax` cookies scoped strictly to `/api/v1/auth`.
  - Only SHA-256 hashed representations are stored in PostgreSQL (`Session.hashedToken`).
  - **Token Family Replay Revocation**: If an attacker attempts to replay a consumed or rotated token, Nimu identifies a token-family collision and instantly revokes all active sessions for that user.
- **Session Control**:
  - `/api/v1/auth/logout`: Revokes current active session.
  - `/api/v1/auth/logout-all`: Invalidation across all devices and browsers.

---

## 2. Multi-Tenant Authorization & Data Isolation

- **Mandatory User Scoping**:
  - Every mutable and read query strictly enforces `WHERE userId = request.user.id`.
  - There are zero shared collections, stickies, or notes. Cross-tenant access is structurally impossible at the ORM layer.
- **Optimistic Concurrency Control**:
  - Every mutable record tracks an integer `version` field. Mutations must send current version or `If-Match`. Stale updates return `409 Conflict`.
- **Soft Delete with Automated 30-Day Retention**:
  - Entities flag `deletedAt`. Background retention cleanup runs daily to hard-purge records older than 30 days.
- **Account Deletion (Right to Erasure / GDPR)**:
  - `DELETE /api/v1/auth/me` requires explicit password confirmation. Cascades deletion across all notes, tags, stickies, drawings, transactions, budgets, media assets, and active sessions.

---

## 3. Threat Modeling & Input Defenses

| Threat Vector | Defense Mechanism |
|---|---|
| **SQL Injection (SQLi)** | Parameterized queries enforced at compile-time via Prisma ORM. No dynamic raw SQL string interpolation. |
| **Cross-Site Scripting (XSS)** | ProseMirror TipTap document tree sanitization. Script tags, inline handlers, and raw HTML are completely stripped. External links only permit `http`, `https`, `mailto`. |
| **Server-Side Request Forgery (SSRF)** | Media URL validator actively checks hostnames and resolves IP addresses, blocking private subnets (RFC 1918 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), AWS metadata (`169.254.169.254`), and loopback (`127.0.0.1`). |
| **Brute Force & Credential Stuffing** | Fastify rate-limiting on sensitive endpoints (`/api/v1/auth/*`) limited to 20 attempts per minute per IP. |
| **Double Spend / Network Flakiness** | Mandatory or optional `X-Idempotency-Key` headers on transaction creation to prevent duplicates on unstable mobile connections. |
| **Clickjacking & MIME Sniffing** | Fastify Helmet configured with `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. |

---

## 4. Security Audit Logging

All security-sensitive operations trigger an asynchronous audit entry in the `AuditLog` table via `apps/api/src/lib/audit.ts`:
- `auth.login` (Success and failed password verification)
- `auth.register`
- `auth.token_reuse_detected` (Triggers alert and token family wipe)
- `auth.password_changed`
- `auth.account_deleted`
- `auth.logout_all`

---

## 5. Vulnerability Reporting

If you discover a security vulnerability in Nimu, please report it privately via GitHub Security Advisories or email `security@nimu.app`. We acknowledge reports within 24 hours and issue CVE patches promptly.

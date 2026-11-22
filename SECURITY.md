# Security Model & Data Protections — Nimu

## 1. Authentication & Session Security
- **Password Storage**: Uses Argon2id with 64MB memory cost, 3 iterations, and 1 thread parallelism (`m=65536, t=3, p=1`). Common passwords and short strings are rejected.
- **Short-Lived Access Tokens**: Signed JWTs expiring in 15 minutes, validated statelessly by Fastify.
- **Rotating Refresh Tokens**: 384-bit cryptographically secure random tokens stored in `httpOnly`, `Secure`, `SameSite=Lax` cookies with restricted path (`/api/v1/auth`). Only SHA-256 hashed representations are stored in the PostgreSQL database.
- **Reuse Detection & Token Families**: If a revoked refresh token is re-submitted, Nimu detects replay attack patterns and revokes all active sessions in the token family.
- **Session Control**: Supports single-session logout (`/auth/logout`) and global revocation across all devices (`/auth/logout-all`).

## 2. Authorization & Data Isolation
- **Multi-Tenant Isolation**: Every database entity is tied to `userId`. All repository queries enforce `WHERE userId = ...`.
- **Soft Deletion & Purging**: Deletions flag `deletedAt` timestamps with scheduled 30-day automated purge.
- **Account Deletion**: Full account deletion (`DELETE /auth/me`) requires explicit password confirmation and cascades deletion across all notes, transactions, files, themes, and tokens.

## 3. Input Validation & Defenses
- **Zod Strict Validation**: All route inputs, query parameters, and mutations are validated against strict Zod schemas before hitting business logic.
- **SSRF Mitigation**: Media and GIF imports prohibit private IP addresses (RFC 1918) and loopback interfaces.
- **Rate Limiting**: Rate-limiting shields sensitive endpoints (`/auth/login`, `/auth/register`) against credential stuffing and brute-force attacks.

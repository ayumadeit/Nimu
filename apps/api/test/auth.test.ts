import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import * as security from '../src/lib/security.js';

vi.mock('../src/lib/prisma.js', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$fakehash',
    displayName: 'Test User',
    avatarUrl: null,
    timeZone: 'Asia/Kolkata',
    currency: 'INR',
    locale: 'en-IN',
    createdAt: new Date(),
    updatedAt: new Date(),
    emailVerifiedAt: null,
  };

  const mockPreferences = {
    id: 'pref-123',
    userId: 'user-123',
    themeId: 'original',
    mode: 'system',
    sidebarCollapsed: false,
    dashboardWidgets: [],
    noteDefaults: {},
    financeDefaults: {},
    onboardingCompletedAt: null,
  };

  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      session: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      preferences: {
        findUnique: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      stickyBoard: {
        create: vi.fn(),
      },
      customTheme: {
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        return cb(prisma);
      }),
      $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    },
  };
});

describe('Foundation & Auth Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /healthz returns status ok', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeDefined();
  });

  it('POST /api/v1/auth/register fails with weak password', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'hello@example.com',
        password: 'password123',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('WEAK_PASSWORD');
  });

  it('POST /api/v1/auth/register successfully creates user and returns tokens', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'newuser@example.com',
      passwordHash: 'hashed',
      displayName: 'newuser',
      avatarUrl: null,
      timeZone: 'Asia/Kolkata',
      currency: 'INR',
      locale: 'en-IN',
      createdAt: new Date(),
    };

    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue(mockUser);
    (prisma.session.create as any).mockResolvedValue({ id: 'sess-1' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'newuser@example.com',
        password: 'AComplexPassword987!#',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.user.email).toBe('newuser@example.com');
    expect(body.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /api/v1/auth/login validates credentials and creates session', async () => {
    const hash = await security.hashPassword('MySecretPass123!');
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user-123',
      email: 'user@example.com',
      passwordHash: hash,
      displayName: 'User',
      avatarUrl: null,
      timeZone: 'Asia/Kolkata',
      currency: 'INR',
      locale: 'en-IN',
      createdAt: new Date(),
    });
    (prisma.session.create as any).mockResolvedValue({ id: 'sess-1' });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'user@example.com',
        password: 'MySecretPass123!',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.accessToken).toBeDefined();
    expect(body.user.email).toBe('user@example.com');
  });

  it('POST /api/v1/auth/refresh triggers reuse detection if token was revoked', async () => {
    (prisma.session.findFirst as any).mockResolvedValue({
      id: 'sess-old',
      userId: 'user-123',
      revokedAt: new Date(), // Already revoked!
      expiresAt: new Date(Date.now() + 100000),
      user: { id: 'user-123', email: 'user@example.com' },
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: {
        nimu_refresh_token: 'some_revoked_token',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('TOKEN_REUSE_DETECTED');
    // Verifies all active user sessions are revoked
    expect(prisma.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-123', revokedAt: null },
      })
    );
  });
});

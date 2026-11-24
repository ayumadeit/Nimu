import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import * as security from '../src/lib/security.js';

vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      note: { findMany: vi.fn() },
      transaction: { findMany: vi.fn() },
      stickyNote: { findMany: vi.fn() },
    },
  };
});

describe('Phase 5: Global Multi-Entity Search API', () => {
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    token = await security.signAccessToken({ sub: 'user-123', email: 'user@example.com' });
  });

  it('GET /api/v1/search queries notes, transactions, and stickies', async () => {
    (prisma.note.findMany as any).mockResolvedValue([
      { id: 'note-1', title: 'Coffee brewing techniques', excerpt: 'French press vs pour over', plainText: 'Full content', updatedAt: new Date('2026-05-10') },
    ]);
    (prisma.transaction.findMany as any).mockResolvedValue([
      { id: 'tx-1', type: 'expense', amountMinor: 25000, category: 'Food', description: 'Coffee beans', date: new Date('2026-05-12') },
    ]);
    (prisma.stickyNote.findMany as any).mockResolvedValue([
      { id: 'sticky-1', text: 'Buy coffee beans today', color: '#FFF3B0', updatedAt: new Date('2026-05-11') },
    ]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=coffee',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.query).toBe('coffee');
    expect(body.totalMatches).toBe(3);
    expect(body.results.notes).toHaveLength(1);
    expect(body.results.notes[0].title).toBe('Coffee brewing techniques');
    expect(body.results.transactions).toHaveLength(1);
    expect(body.results.transactions[0].title).toBe('Coffee beans');
    expect(body.results.stickies).toHaveLength(1);
    expect(body.results.stickies[0].snippet).toBe('Buy coffee beans today');
  });

  it('GET /api/v1/search filters by entity type if requested', async () => {
    (prisma.note.findMany as any).mockResolvedValue([
      { id: 'note-1', title: 'Coffee brewing', excerpt: 'Pour over', plainText: 'Pour over', updatedAt: new Date('2026-05-10') },
    ]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=coffee&types=notes',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.totalMatches).toBe(1);
    expect(body.results.notes).toHaveLength(1);
    expect(body.results.transactions).toHaveLength(0);
    expect(body.results.stickies).toHaveLength(0);
  });
});

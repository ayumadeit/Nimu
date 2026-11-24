import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import * as security from '../src/lib/security.js';

vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      note: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      transaction: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      stickyNote: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      savingsGoal: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      preferences: { findUnique: vi.fn(), upsert: vi.fn() },
      customTheme: { findMany: vi.fn() },
      drawing: { findMany: vi.fn() },
      budget: { findMany: vi.fn() },
    },
  };
});

describe('Phase 5: Data Portability & LocalStorage Migration API', () => {
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    token = await security.signAccessToken({ sub: 'user-123', email: 'user@example.com' });
  });

  it('GET /api/v1/data/export/notes?format=md exports markdown with frontmatter', async () => {
    (prisma.note.findMany as any).mockResolvedValue([
      {
        id: 'n-1',
        title: 'Morning Routine',
        plainText: 'Drink warm water and write 3 things.',
        updatedAt: new Date('2026-05-15T08:00:00Z'),
        isPinned: true,
        collection: { id: 'c-1', name: 'Routines' },
        tags: [{ tag: { name: 'wellness' } }],
      },
    ]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/data/export/notes?format=md',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/markdown');
    expect(res.body).toContain('---');
    expect(res.body).toContain('title: "Morning Routine"');
    expect(res.body).toContain('tags: [wellness]');
    expect(res.body).toContain('# Morning Routine');
    expect(res.body).toContain('Drink warm water and write 3 things.');
  });

  it('GET /api/v1/data/export/transactions?format=csv returns proper CSV headers and rows', async () => {
    (prisma.transaction.findMany as any).mockResolvedValue([
      {
        id: 'tx-1',
        date: new Date('2026-05-20'),
        type: 'expense',
        amountMinor: 25000,
        category: 'Food',
        description: 'Boba Tea',
        paymentMethod: 'upi',
        notes: 'With pearl',
      },
    ]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/data/export/transactions?format=csv',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body).toContain('Date,Type,Amount (INR),Category,Description,Payment Method,Notes');
    expect(res.body).toContain('"2026-05-20","expense","250.00","Food","Boba Tea","upi","With pearl"');
  });

  it('GET /api/v1/data/export/all returns comprehensive backup object', async () => {
    (prisma.preferences.findUnique as any).mockResolvedValue({ themeId: 'matcha', mode: 'system' });
    (prisma.customTheme.findMany as any).mockResolvedValue([]);
    (prisma.note.findMany as any).mockResolvedValue([]);
    (prisma.stickyNote.findMany as any).mockResolvedValue([]);
    (prisma.drawing.findMany as any).mockResolvedValue([]);
    (prisma.transaction.findMany as any).mockResolvedValue([]);
    (prisma.budget.findMany as any).mockResolvedValue([]);
    (prisma.savingsGoal.findMany as any).mockResolvedValue([]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/data/export/all',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.version).toBe('1.0.0');
    expect(body.user.email).toBe('user@example.com');
    expect(body.preferences.themeId).toBe('matcha');
  });

  it('POST /api/v1/data/import/local-storage idempotently migrates client data', async () => {
    // Note 1 exists, Note 2 does not
    (prisma.note.findFirst as any)
      .mockResolvedValueOnce({ id: 'existing-note' })
      .mockResolvedValueOnce(null);
    (prisma.note.create as any).mockResolvedValue({ id: 'new-note' });

    // Sticky 1 does not exist
    (prisma.stickyNote.findFirst as any).mockResolvedValue(null);
    (prisma.stickyNote.create as any).mockResolvedValue({ id: 'new-sticky' });

    // Transaction 1 does not exist
    (prisma.transaction.findFirst as any).mockResolvedValue(null);
    (prisma.transaction.create as any).mockResolvedValue({ id: 'new-tx' });

    (prisma.preferences.upsert as any).mockResolvedValue({});

    const app = await buildApp();
    const payload = {
      themeId: 'lavender',
      budget: 35000,
      notes: [
        { title: 'Old Note', body: 'Already migrated' },
        { title: 'New Note', body: 'Fresh from localStorage' },
      ],
      stickies: [{ text: 'Don’t forget milk', color: '#FFF3B0', rot: -1 }],
      txs: [
        {
          type: 'expense' as const,
          amount: 150,
          category: 'Grocery',
          desc: 'Organic milk',
          date: '2026-05-20',
        },
      ],
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/data/import/local-storage',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.success).toBe(true);
    expect(body.imported.notes).toBe(1); // Only 1 was new
    expect(body.imported.stickies).toBe(1);
    expect(body.imported.transactions).toBe(1);
    expect(prisma.note.create).toHaveBeenCalledTimes(1);
  });
});

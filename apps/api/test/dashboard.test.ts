import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import * as security from '../src/lib/security.js';

vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      preferences: { findUnique: vi.fn() },
      budget: { findUnique: vi.fn() },
      transaction: { findMany: vi.fn() },
      note: { findMany: vi.fn() },
      stickyNote: { findMany: vi.fn() },
      savingsGoal: { findMany: vi.fn() },
    },
  };
});

describe('Phase 5: Single-Call Dashboard API', () => {
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    token = await security.signAccessToken({ sub: 'user-123', email: 'user@example.com' });
  });

  it('GET /api/v1/dashboard returns unified homepage payload in a single response', async () => {
    (prisma.preferences.findUnique as any).mockResolvedValue({
      financeDefaults: { monthlyBudget: 2500000 },
      dashboardWidgets: [{ id: 'spend', visible: true }],
    });
    (prisma.budget.findUnique as any).mockResolvedValue({ totalLimitMinor: 3000000 });
    (prisma.transaction.findMany as any)
      .mockResolvedValueOnce([{ type: 'expense', amountMinor: 400000 }, { type: 'income', amountMinor: 800000 }]) // monthTransactions
      .mockResolvedValueOnce([{ date: new Date(), amountMinor: 150000 }]) // fourteenDayExpenses
      .mockResolvedValueOnce([{ id: 'tx-1', type: 'expense', amountMinor: 20000, category: 'Food', description: 'Coffee', paymentMethod: 'upi', date: new Date() }]); // recentTransactions
    (prisma.note.findMany as any).mockResolvedValue([
      { id: 'n-1', title: 'Roadmap', excerpt: 'Build Nimu', plainText: 'Build Nimu', updatedAt: new Date(), tags: [] },
    ]);
    (prisma.stickyNote.findMany as any).mockResolvedValue([
      { id: 's-1', text: 'Call Nani', color: '#FFF3B0', rotation: -2, zIndex: 1 },
    ]);
    (prisma.savingsGoal.findMany as any).mockResolvedValue([
      { id: 'g-1', name: 'MacBook', targetMinor: 10000000, savedMinor: 4000000, icon: 'Laptop', color: '#6366F1' },
    ]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.summary.spentMinor).toBe(400000);
    expect(body.summary.incomeMinor).toBe(800000);
    expect(body.summary.budgetLimitMinor).toBe(3000000);
    expect(body.summary.budgetLeftMinor).toBe(2600000);
    expect(body.spendTrend).toHaveLength(14);
    expect(body.recentNotes).toHaveLength(1);
    expect(body.pinnedStickies).toHaveLength(1);
    expect(body.recentTransactions).toHaveLength(1);
    expect(body.savingsGoals).toHaveLength(1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import * as security from '../src/lib/security.js';

vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      transaction: {
        findMany: vi.fn(),
        aggregate: vi.fn(),
      },
      budget: {
        findUnique: vi.fn(),
      },
      preferences: {
        findUnique: vi.fn(),
      },
    },
  };
});

describe('Phase 5: Insights Analytics API', () => {
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    token = await security.signAccessToken({ sub: 'user-123', email: 'user@example.com' });
  });

  it('GET /api/v1/insights/summary computes monthly metrics & comparison', async () => {
    (prisma.transaction.findMany as any).mockResolvedValue([
      { type: 'expense', amountMinor: 200000, date: new Date('2026-11-05') },
      { type: 'expense', amountMinor: 500000, date: new Date('2026-11-12') }, // highest day: 5000 INR
      { type: 'income', amountMinor: 1000000, date: new Date('2026-11-01') },
    ]);
    (prisma.transaction.aggregate as any).mockResolvedValue({
      _sum: { amountMinor: 500000 }, // previous month spent: 5000 INR
    });
    (prisma.budget.findUnique as any).mockResolvedValue({ totalLimitMinor: 1000000 });
    (prisma.preferences.findUnique as any).mockResolvedValue(null);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/insights/summary?month=2026-11',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.totalSpentMinor).toBe(700000);
    expect(body.totalIncomeMinor).toBe(1000000);
    expect(body.netSavingsMinor).toBe(300000);
    expect(body.highestSpendingDay.date).toBe('2026-11-12');
    expect(body.highestSpendingDay.amountMinor).toBe(500000);
    // Previous spent: 500k, current: 700k -> +40%
    expect(body.comparisonPreviousMonth).toBe(40);
  });

  it('GET /api/v1/insights/daily returns zero-filled series for dates without spend', async () => {
    (prisma.transaction.findMany as any).mockResolvedValue([
      { type: 'expense', amountMinor: 100000, date: new Date('2026-11-02') },
    ]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/insights/daily?from=2026-11-01&to=2026-11-03',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(3);
    // 2026-11-01 was zero-filled
    expect(body[0].date).toBe('2026-11-01');
    expect(body[0].expenseMinor).toBe(0);
    // 2026-11-02 had 1000 INR
    expect(body[1].date).toBe('2026-11-02');
    expect(body[1].expenseMinor).toBe(100000);
  });
});

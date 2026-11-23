import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import * as security from '../src/lib/security.js';

vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      transaction: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      budget: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findFirst: vi.fn(),
      },
      categoryBudget: {
        upsert: vi.fn(),
      },
      savingsGoal: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      goalContribution: {
        create: vi.fn(),
        aggregate: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        delete: vi.fn(),
      },
      preferences: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    },
  };
});

describe('Phase 4: Finance, Budgets & Savings Goals API', () => {
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    token = await security.signAccessToken({ sub: 'user-123', email: 'user@example.com' });
  });

  it('POST /api/v1/transactions creates transaction in integer minor units (paise)', async () => {
    const mockTx = {
      id: 'tx-1',
      userId: 'user-123',
      type: 'expense',
      amountMinor: 25000, // 250 INR
      currency: 'INR',
      category: 'Food',
      description: 'Chai and Samosa',
      paymentMethod: 'upi',
      date: new Date('2026-11-23'),
      notes: 'Evening snack',
      idempotencyKey: 'key-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    (prisma.transaction.findFirst as any).mockResolvedValue(null);
    (prisma.transaction.create as any).mockResolvedValue(mockTx);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        type: 'expense',
        amountMinor: 25000,
        category: 'Food',
        description: 'Chai and Samosa',
        paymentMethod: 'upi',
        date: '2026-11-23',
        notes: 'Evening snack',
        idempotencyKey: 'key-123',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.amountMinor).toBe(25000);
    expect(body.date).toBe('2026-11-23');
    expect(prisma.transaction.create).toHaveBeenCalled();
  });

  it('POST /api/v1/transactions honors idempotency key to prevent double submit', async () => {
    const existingTx = {
      id: 'tx-existing',
      userId: 'user-123',
      type: 'expense',
      amountMinor: 25000,
      currency: 'INR',
      category: 'Food',
      description: 'Chai and Samosa',
      paymentMethod: 'upi',
      date: new Date('2026-11-23'),
      notes: '',
      idempotencyKey: 'dup-key',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    (prisma.transaction.findFirst as any).mockResolvedValue(existingTx);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        type: 'expense',
        amountMinor: 25000,
        category: 'Food',
        description: 'Chai and Samosa',
        paymentMethod: 'upi',
        date: '2026-11-23',
        idempotencyKey: 'dup-key',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe('tx-existing');
    // Ensure no new transaction was created
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('GET /api/v1/budgets/:month/status correctly calculates budget warnings and exceeded status', async () => {
    // Budget: 10,000 INR = 1,000,000 paise
    (prisma.budget.findUnique as any).mockResolvedValue({
      id: 'b-1',
      userId: 'user-123',
      month: '2026-11',
      totalLimitMinor: 1000000,
      categoryBudgets: [
        { category: 'Food', limitMinor: 400000 },
        { category: 'Shopping', limitMinor: 200000 },
      ],
    });

    // Expenses: Food: 3,50,000 (87.5% -> warning), Shopping: 2,50,000 (125% -> exceeded)
    (prisma.transaction.findMany as any).mockResolvedValue([
      { amountMinor: 350000, category: 'Food' },
      { amountMinor: 250000, category: 'Shopping' },
    ]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/budgets/2026-11/status',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.total.spentMinor).toBe(600000);
    expect(body.total.utilizationPercent).toBe(60);
    expect(body.total.status).toBe('ok');

    const foodStatus = body.categories.find((c: any) => c.category === 'Food');
    expect(foodStatus.status).toBe('warning'); // 87.5% >= 80%

    const shoppingStatus = body.categories.find((c: any) => c.category === 'Shopping');
    expect(shoppingStatus.status).toBe('exceeded'); // 125% > 100%
  });

  it('POST /api/v1/goals/:id/contributions updates savedMinor and marks goal completed if target reached', async () => {
    const goal = {
      id: 'goal-1',
      userId: 'user-123',
      name: 'Kindle Paperwhite',
      targetMinor: 1500000, // 15,000 INR
      savedMinor: 1000000,
      targetDate: null,
      icon: 'Book',
      color: '#6366F1',
      completedAt: null,
    };

    (prisma.savingsGoal.findFirst as any).mockResolvedValue(goal);
    (prisma.goalContribution.create as any).mockResolvedValue({
      id: 'c-1',
      goalId: 'goal-1',
      userId: 'user-123',
      amountMinor: 500000,
      date: new Date('2026-11-23'),
      note: 'Birthday money',
    });
    // Total aggregate sum becomes 15,00,000 (100% of target)
    (prisma.goalContribution.aggregate as any).mockResolvedValue({
      _sum: { amountMinor: 1500000 },
    });
    (prisma.savingsGoal.update as any).mockImplementation(({ data }: any) => {
      return {
        ...goal,
        savedMinor: data.savedMinor,
        completedAt: data.completedAt,
      };
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/goals/goal-1/contributions',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        amountMinor: 500000,
        date: '2026-11-23',
        note: 'Birthday money',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.goal.savedMinor).toBe(1500000);
    expect(body.goal.progressPercent).toBe(100);
    expect(body.goal.completedAt).toBeDefined();
  });
});

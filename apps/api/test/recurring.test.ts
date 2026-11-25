import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import * as security from '../src/lib/security.js';
import { calculateNextRun, processDueRecurringRules } from '../src/lib/recurringCron.js';

vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      recurringRule: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      transaction: {
        create: vi.fn(),
      },
    },
  };
});

describe('Phase 6: Recurring Transactions & Cron Engine', () => {
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    token = await security.signAccessToken({ sub: 'user-123', email: 'user@example.com' });
  });

  it('calculateNextRun advances dates correctly for all frequencies', () => {
    const base = new Date('2026-05-01T00:00:00Z');
    expect(calculateNextRun(base, 'daily').toISOString().slice(0, 10)).toBe('2026-05-02');
    expect(calculateNextRun(base, 'weekly').toISOString().slice(0, 10)).toBe('2026-05-08');
    expect(calculateNextRun(base, 'monthly').toISOString().slice(0, 10)).toBe('2026-06-01');
    expect(calculateNextRun(base, 'yearly').toISOString().slice(0, 10)).toBe('2027-05-01');
  });

  it('POST /api/v1/recurring creates rule with valid template and frequency', async () => {
    const mockRule = {
      id: 'rule-1',
      userId: 'user-123',
      frequency: 'monthly',
      nextRunAt: new Date('2026-06-01'),
      template: {
        type: 'expense',
        amountMinor: 49900,
        category: 'Subscriptions',
        description: 'Netflix 4K',
        paymentMethod: 'card',
        notes: '',
      },
    };
    (prisma.recurringRule.create as any).mockResolvedValue(mockRule);

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recurring',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        frequency: 'monthly',
        template: {
          type: 'expense',
          amountMinor: 49900,
          category: 'Subscriptions',
          description: 'Netflix 4K',
          paymentMethod: 'card',
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBe('rule-1');
    expect(body.frequency).toBe('monthly');
  });

  it('processDueRecurringRules finds overdue rules and generates transactions', async () => {
    const pastDate = new Date('2026-05-01T00:00:00Z');
    const currentDate = new Date('2026-05-01T12:00:00Z');

    (prisma.recurringRule.findMany as any).mockResolvedValue([
      {
        id: 'rule-1',
        userId: 'user-123',
        frequency: 'monthly',
        nextRunAt: pastDate,
        template: {
          type: 'expense',
          amountMinor: 150000,
          category: 'Bills',
          description: 'Broadband',
          paymentMethod: 'upi',
        },
      },
    ]);

    (prisma.transaction.create as any).mockResolvedValue({ id: 'tx-new' });
    (prisma.recurringRule.update as any).mockResolvedValue({});

    const result = await processDueRecurringRules(currentDate);

    expect(result.processedRules).toBe(1);
    expect(result.createdTransactions).toBe(1);
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-123',
          amountMinor: 150000,
          isRecurring: true,
          recurringRuleId: 'rule-1',
        }),
      })
    );
    expect(prisma.recurringRule.update).toHaveBeenCalled();
  });
});

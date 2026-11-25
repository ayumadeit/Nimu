import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import * as security from '../src/lib/security.js';

vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      preferences: { findUnique: vi.fn() },
      budget: { findUnique: vi.fn(), findMany: vi.fn() },
      transaction: { findMany: vi.fn() },
      note: { findMany: vi.fn(), update: vi.fn() },
      stickyNote: { findMany: vi.fn(), updateMany: vi.fn() },
      savingsGoal: { findMany: vi.fn() },
    },
  };
});

describe('Phase 6: SLA Benchmark & Latency Suite', () => {
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    token = await security.signAccessToken({ sub: 'user-bench', email: 'bench@nimu.test' });
  });

  function calculatePercentile(latencies: number[], p: number): number {
    const sorted = [...latencies].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  it('Dashboard endpoint satisfies SLA target (p95 < 150ms)', async () => {
    (prisma.preferences.findUnique as any).mockResolvedValue({
      financeDefaults: { monthlyBudget: 4500000 },
      dashboardWidgets: [],
    });
    (prisma.budget.findUnique as any).mockResolvedValue({ totalLimitMinor: 5000000 });
    (prisma.transaction.findMany as any).mockResolvedValue([{ type: 'expense', amountMinor: 200000, date: new Date() }]);
    (prisma.note.findMany as any).mockResolvedValue([]);
    (prisma.stickyNote.findMany as any).mockResolvedValue([]);
    (prisma.savingsGoal.findMany as any).mockResolvedValue([]);

    const app = await buildApp();
    const latencies: number[] = [];

    // Warm-up
    await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });

    // 25 sample requests
    for (let i = 0; i < 25; i++) {
      const start = performance.now();
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/dashboard',
        headers: { authorization: `Bearer ${token}` },
      });
      const duration = performance.now() - start;
      expect(res.statusCode).toBe(200);
      latencies.push(duration);
    }

    const p95 = calculatePercentile(latencies, 95);
    console.log(`📊 Dashboard p95 latency: ${p95.toFixed(2)} ms (SLA < 150 ms)`);
    expect(p95).toBeLessThan(150);
  });

  it('Global Search endpoint satisfies SLA target (p95 < 100ms)', async () => {
    (prisma.note.findMany as any).mockResolvedValue([]);
    (prisma.transaction.findMany as any).mockResolvedValue([]);
    (prisma.stickyNote.findMany as any).mockResolvedValue([]);

    const app = await buildApp();
    const latencies: number[] = [];

    for (let i = 0; i < 25; i++) {
      const start = performance.now();
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/search?q=coffee',
        headers: { authorization: `Bearer ${token}` },
      });
      const duration = performance.now() - start;
      expect(res.statusCode).toBe(200);
      latencies.push(duration);
    }

    const p95 = calculatePercentile(latencies, 95);
    console.log(`📊 Search p95 latency: ${p95.toFixed(2)} ms (SLA < 100 ms)`);
    expect(p95).toBeLessThan(100);
  });
});

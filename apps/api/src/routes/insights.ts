import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';

// 60-second in-memory cache for insights
interface CacheEntry {
  data: any;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: any, ttlSeconds = 60) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export function invalidateUserInsightsCache(userId: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(`insights:${userId}:`)) {
      cache.delete(key);
    }
  }
}

export async function insightsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /insights/summary?month=YYYY-MM
  app.get('/summary', async (request) => {
    const userId = request.user!.id;
    const { month } = request.query as { month?: string };
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const cacheKey = `insights:${userId}:summary:${targetMonth}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const startDate = new Date(`${targetMonth}-01`);
    const nextMonth = new Date(startDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const prevMonthDate = new Date(startDate);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevMonthStr = prevMonthDate.toISOString().slice(0, 7);
    const prevMonthStart = new Date(`${prevMonthStr}-01`);

    // Fetch transactions in SQL
    const [currentTxs, prevExpenses, budget, prefs] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId,
          deletedAt: null,
          date: { gte: startDate, lt: nextMonth },
        },
        select: { type: true, amountMinor: true, date: true },
      }),
      prisma.transaction.aggregate({
        where: {
          userId,
          type: 'expense',
          deletedAt: null,
          date: { gte: prevMonthStart, lt: startDate },
        },
        _sum: { amountMinor: true },
      }),
      prisma.budget.findUnique({
        where: { userId_month: { userId, month: targetMonth } },
      }),
      prisma.preferences.findUnique({ where: { userId } }),
    ]);

    let totalSpentMinor = 0;
    let totalIncomeMinor = 0;
    const dailySpends = new Map<string, number>();

    for (const t of currentTxs) {
      if (t.type === 'expense') {
        totalSpentMinor += t.amountMinor;
        const d = t.date.toISOString().slice(0, 10);
        dailySpends.set(d, (dailySpends.get(d) || 0) + t.amountMinor);
      } else {
        totalIncomeMinor += t.amountMinor;
      }
    }

    // Find highest spending day
    let highestSpendingDay: { date: string; amountMinor: number } | null = null;
    for (const [d, amt] of dailySpends.entries()) {
      if (!highestSpendingDay || amt > highestSpendingDay.amountMinor) {
        highestSpendingDay = { date: d, amountMinor: amt };
      }
    }

    // Days in month
    const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
    const averageDailySpendMinor = Math.round(totalSpentMinor / daysInMonth);

    // Budget
    const financeDefaults = (prefs?.financeDefaults as any) || {};
    const defaultBudget = typeof financeDefaults.monthlyBudget === 'number' ? financeDefaults.monthlyBudget : 2500000;
    const budgetLimitMinor = budget ? budget.totalLimitMinor : defaultBudget;
    const remainingBudgetMinor = budgetLimitMinor - totalSpentMinor;

    // Previous month comparison
    const prevTotalSpent = prevExpenses._sum.amountMinor ?? 0;
    let comparisonPreviousMonth = 0;
    if (prevTotalSpent > 0) {
      comparisonPreviousMonth = Math.round(((totalSpentMinor - prevTotalSpent) / prevTotalSpent) * 100);
    }

    const result = {
      month: targetMonth,
      totalSpentMinor,
      totalIncomeMinor,
      netSavingsMinor: totalIncomeMinor - totalSpentMinor,
      budgetLimitMinor,
      remainingBudgetMinor,
      averageDailySpendMinor,
      highestSpendingDay: highestSpendingDay || { date: `${targetMonth}-01`, amountMinor: 0 },
      comparisonPreviousMonth,
    };

    setCache(cacheKey, result, 60);
    return result;
  });

  // GET /insights/by-category?from=&to=
  app.get('/by-category', async (request) => {
    const userId = request.user!.id;
    const { from, to } = request.query as { from?: string; to?: string };

    const cacheKey = `insights:${userId}:by-category:${from || ''}:${to || ''}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const where: any = {
      userId,
      type: 'expense',
      deletedAt: null,
    };

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const expenses = await prisma.transaction.findMany({
      where,
      select: { category: true, amountMinor: true },
    });

    let total = 0;
    const catMap = new Map<string, number>();
    for (const exp of expenses) {
      total += exp.amountMinor;
      catMap.set(exp.category, (catMap.get(exp.category) || 0) + exp.amountMinor);
    }

    const categories = Array.from(catMap.entries())
      .map(([category, amountMinor]) => ({
        category,
        amountMinor,
        percentage: total > 0 ? Math.round((amountMinor / total) * 100) : 0,
      }))
      .sort((a, b) => b.amountMinor - a.amountMinor);

    const result = { totalSpentMinor: total, categories };
    setCache(cacheKey, result, 60);
    return result;
  });

  // GET /insights/daily?from=&to= (Zero-filled for days with no spend)
  app.get('/daily', async (request) => {
    const userId = request.user!.id;
    let { from, to } = request.query as { from?: string; to?: string };

    // Default to last 30 days if not passed
    const now = new Date();
    if (!to) to = now.toISOString().slice(0, 10);
    if (!from) {
      const past = new Date(now);
      past.setDate(past.getDate() - 29);
      from = past.toISOString().slice(0, 10);
    }

    const cacheKey = `insights:${userId}:daily:${from}:${to}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        date: { gte: new Date(from), lte: new Date(to) },
      },
      select: { type: true, amountMinor: true, date: true },
    });

    const txMap = new Map<string, { expenseMinor: number; incomeMinor: number }>();
    for (const t of transactions) {
      const d = t.date.toISOString().slice(0, 10);
      const cur = txMap.get(d) || { expenseMinor: 0, incomeMinor: 0 };
      if (t.type === 'expense') cur.expenseMinor += t.amountMinor;
      else cur.incomeMinor += t.amountMinor;
      txMap.set(d, cur);
    }

    // Zero-fill all days between from and to
    const dailyData = [];
    const cur = new Date(from);
    const end = new Date(to);

    while (cur <= end) {
      const dStr = cur.toISOString().slice(0, 10);
      const stats = txMap.get(dStr) || { expenseMinor: 0, incomeMinor: 0 };
      dailyData.push({
        date: dStr,
        expenseMinor: stats.expenseMinor,
        incomeMinor: stats.incomeMinor,
        netMinor: stats.incomeMinor - stats.expenseMinor,
      });
      cur.setDate(cur.getDate() + 1);
    }

    setCache(cacheKey, dailyData, 60);
    return dailyData;
  });

  // GET /insights/monthly-trend?months=6
  app.get('/monthly-trend', async (request) => {
    const userId = request.user!.id;
    const { months } = request.query as { months?: string };
    const numMonths = Math.min(12, Math.max(1, Number(months) || 6));

    const cacheKey = `insights:${userId}:monthly-trend:${numMonths}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    // Generate list of months
    const monthKeys: string[] = [];
    const now = new Date();
    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(d.toISOString().slice(0, 7));
    }

    const startMonthDate = new Date(`${monthKeys[0]}-01`);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        deletedAt: null,
        date: { gte: startMonthDate },
      },
      select: { type: true, amountMinor: true, date: true },
    });

    const trendMap = new Map<string, { expenseMinor: number; incomeMinor: number }>();
    for (const k of monthKeys) {
      trendMap.set(k, { expenseMinor: 0, incomeMinor: 0 });
    }

    for (const t of transactions) {
      const mStr = t.date.toISOString().slice(0, 7);
      const cur = trendMap.get(mStr);
      if (cur) {
        if (t.type === 'expense') cur.expenseMinor += t.amountMinor;
        else cur.incomeMinor += t.amountMinor;
      }
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = monthKeys.map((m) => {
      const stats = trendMap.get(m)!;
      const parts = m.split('-');
      const monthIdx = parseInt(parts[1], 10) - 1;
      return {
        month: m,
        label: `${monthNames[monthIdx]} '${parts[0].slice(2)}`,
        expenseMinor: stats.expenseMinor,
        incomeMinor: stats.incomeMinor,
        netMinor: stats.incomeMinor - stats.expenseMinor,
      };
    });

    setCache(cacheKey, result, 60);
    return result;
  });

  // GET /insights/income-vs-expense?months=6
  app.get('/income-vs-expense', async (request) => {
    // Reuses monthly trend with comparison metrics
    const userId = request.user!.id;
    const { months } = request.query as { months?: string };
    const numMonths = Math.min(12, Math.max(1, Number(months) || 6));

    const trend = await app.inject({
      method: 'GET',
      url: `/api/v1/insights/monthly-trend?months=${numMonths}`,
      headers: { authorization: request.headers.authorization! },
    });

    return JSON.parse(trend.body);
  });
}

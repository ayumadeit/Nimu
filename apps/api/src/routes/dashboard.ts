import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middlewares/auth.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /dashboard (Single-call dashboard aggregator)
  app.get('/', async (request) => {
    const userId = request.user!.id;
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const monthStart = new Date(`${currentMonth}-01`);
    const nextMonthStart = new Date(monthStart);
    nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

    // 14 days ago start
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 13);
    const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().slice(0, 10);
    const fourteenDaysStart = new Date(fourteenDaysAgoStr);

    // Parallel fetch
    const [
      prefs,
      monthBudget,
      monthTransactions,
      fourteenDayExpenses,
      recentNotes,
      pinnedStickies,
      recentTransactions,
      savingsGoals,
    ] = await Promise.all([
      prisma.preferences.findUnique({ where: { userId } }),
      prisma.budget.findUnique({ where: { userId_month: { userId, month: currentMonth } } }),
      prisma.transaction.findMany({
        where: {
          userId,
          deletedAt: null,
          date: { gte: monthStart, lt: nextMonthStart },
        },
        select: { type: true, amountMinor: true },
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          type: 'expense',
          deletedAt: null,
          date: { gte: fourteenDaysStart },
        },
        select: { date: true, amountMinor: true },
      }),
      prisma.note.findMany({
        where: { userId, deletedAt: null, isArchived: false },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          title: true,
          excerpt: true,
          plainText: true,
          updatedAt: true,
          tags: { select: { tag: { select: { name: true } } } },
        },
      }),
      prisma.stickyNote.findMany({
        where: { userId, pinnedToDashboard: true, deletedAt: null },
        orderBy: { zIndex: 'asc' },
        take: 10,
        select: {
          id: true,
          text: true,
          color: true,
          rotation: true,
          zIndex: true,
        },
      }),
      prisma.transaction.findMany({
        where: { userId, deletedAt: null },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        select: {
          id: true,
          type: true,
          amountMinor: true,
          category: true,
          description: true,
          paymentMethod: true,
          date: true,
        },
      }),
      prisma.savingsGoal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          targetMinor: true,
          savedMinor: true,
          icon: true,
          color: true,
        },
      }),
    ]);

    // Compute month totals
    let spentMinor = 0;
    let incomeMinor = 0;
    for (const t of monthTransactions) {
      if (t.type === 'expense') spentMinor += t.amountMinor;
      else incomeMinor += t.amountMinor;
    }

    const financeDefaults = (prefs?.financeDefaults as any) || {};
    const defaultBudget = typeof financeDefaults.monthlyBudget === 'number' ? financeDefaults.monthlyBudget : 2500000;
    const budgetLimitMinor = monthBudget ? monthBudget.totalLimitMinor : defaultBudget;
    const budgetLeftMinor = Math.max(0, budgetLimitMinor - spentMinor);
    const budgetUtilizationPercent = budgetLimitMinor > 0 ? Math.round((spentMinor / budgetLimitMinor) * 100) : 0;

    // Zero-filled 14-day spend trend
    const fourteenDayMap = new Map<string, number>();
    for (const exp of fourteenDayExpenses) {
      const dStr = exp.date.toISOString().slice(0, 10);
      fourteenDayMap.set(dStr, (fourteenDayMap.get(dStr) || 0) + exp.amountMinor);
    }

    const spendTrend = [];
    const loopDate = new Date(fourteenDaysStart);
    for (let i = 0; i < 14; i++) {
      const fullDate = loopDate.toISOString().slice(0, 10);
      spendTrend.push({
        d: fullDate.slice(5), // MM-DD for chart
        fullDate,
        amountMinor: fourteenDayMap.get(fullDate) || 0,
      });
      loopDate.setDate(loopDate.getDate() + 1);
    }

    // Savings totals
    let savingsTotalMinor = 0;
    let savingsTargetMinor = 0;
    const formattedGoals = savingsGoals.map((g) => {
      savingsTotalMinor += g.savedMinor;
      savingsTargetMinor += g.targetMinor;
      return {
        ...g,
        progressPercent: g.targetMinor > 0 ? Math.min(100, Math.round((g.savedMinor / g.targetMinor) * 100)) : 0,
      };
    });

    const defaultWidgets = [
      'spend',
      'budget',
      'income',
      'savings',
      'trend',
      'notes',
      'stickies',
      'transactions',
    ].map((id) => ({ id, visible: true }));

    const widgetLayout = (prefs?.dashboardWidgets as any) || defaultWidgets;

    return {
      summary: {
        spentMinor,
        incomeMinor,
        budgetLimitMinor,
        budgetLeftMinor,
        budgetUtilizationPercent,
        savingsTotalMinor,
        savingsTargetMinor,
      },
      spendTrend,
      recentNotes: recentNotes.map((n) => ({
        id: n.id,
        title: n.title,
        excerpt: n.excerpt || n.plainText.slice(0, 80),
        updatedAt: n.updatedAt.toISOString(),
        tags: n.tags.map((t) => t.tag.name),
      })),
      pinnedStickies: pinnedStickies.map((s) => ({
        id: s.id,
        text: s.text,
        color: s.color,
        rot: s.rotation,
        zIndex: s.zIndex,
      })),
      recentTransactions: recentTransactions.map((t) => ({
        ...t,
        date: t.date.toISOString().slice(0, 10),
      })),
      savingsGoals: formattedGoals,
      widgets: widgetLayout,
    };
  });
}

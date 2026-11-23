import { FastifyInstance } from 'fastify';
import { SetBudgetInputSchema } from '@nimu/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';

export async function budgetsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // Helper to get user's default budget from preferences
  async function getDefaultBudgetLimit(userId: string): Promise<number> {
    const prefs = await prisma.preferences.findUnique({ where: { userId } });
    const financeDefaults = (prefs?.financeDefaults as any) || {};
    return typeof financeDefaults.monthlyBudget === 'number' ? financeDefaults.monthlyBudget : 2500000; // 25,000 INR default in paise
  }

  // GET /budgets/:month
  app.get('/:month', async (request) => {
    const userId = request.user!.id;
    const { month } = request.params as { month: string };

    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new AppError(400, 'INVALID_MONTH', 'Month must be in YYYY-MM format.');
    }

    const budget = await prisma.budget.findUnique({
      where: { userId_month: { userId, month } },
      include: { categoryBudgets: true },
    });

    if (!budget) {
      const defaultTotal = await getDefaultBudgetLimit(userId);
      return {
        month,
        totalLimitMinor: defaultTotal,
        categoryBudgets: [],
        isDefault: true,
      };
    }

    return {
      ...budget,
      isDefault: false,
    };
  });

  // PUT /budgets/:month
  app.put('/:month', async (request) => {
    const userId = request.user!.id;
    const { month } = request.params as { month: string };
    const body = SetBudgetInputSchema.parse(request.body);

    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new AppError(400, 'INVALID_MONTH', 'Month must be in YYYY-MM format.');
    }

    const budget = await prisma.$transaction(async (tx) => {
      const upserted = await tx.budget.upsert({
        where: { userId_month: { userId, month } },
        update: { totalLimitMinor: body.totalLimitMinor },
        create: {
          userId,
          month,
          totalLimitMinor: body.totalLimitMinor,
        },
      });

      // Upsert category budgets
      if (body.categoryLimits && body.categoryLimits.length > 0) {
        for (const cat of body.categoryLimits) {
          await tx.categoryBudget.upsert({
            where: {
              budgetId_category: {
                budgetId: upserted.id,
                category: cat.category,
              },
            },
            update: { limitMinor: cat.limitMinor },
            create: {
              budgetId: upserted.id,
              category: cat.category,
              limitMinor: cat.limitMinor,
            },
          });
        }
      }

      return tx.budget.findUnique({
        where: { id: upserted.id },
        include: { categoryBudgets: true },
      });
    });

    return budget;
  });

  // GET /budgets/:month/status (Limit, spent, remaining, utilization percent, and status)
  app.get('/:month/status', async (request) => {
    const userId = request.user!.id;
    const { month } = request.params as { month: string };

    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new AppError(400, 'INVALID_MONTH', 'Month must be in YYYY-MM format.');
    }

    // 1. Fetch budget or fallback
    let budget = await prisma.budget.findUnique({
      where: { userId_month: { userId, month } },
      include: { categoryBudgets: true },
    });

    const totalLimitMinor = budget ? budget.totalLimitMinor : await getDefaultBudgetLimit(userId);
    const categoryBudgetsMap = new Map<string, number>();
    if (budget) {
      for (const cb of budget.categoryBudgets) {
        categoryBudgetsMap.set(cb.category, cb.limitMinor);
      }
    }

    // 2. Query month expenses
    const startDate = new Date(`${month}-01`);
    const nextMonth = new Date(startDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const expenses = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'expense',
        deletedAt: null,
        date: {
          gte: startDate,
          lt: nextMonth,
        },
      },
      select: {
        amountMinor: true,
        category: true,
      },
    });

    // 3. Compute totals and category spends
    let totalSpentMinor = 0;
    const categorySpentMap = new Map<string, number>();

    for (const exp of expenses) {
      totalSpentMinor += exp.amountMinor;
      const prev = categorySpentMap.get(exp.category) || 0;
      categorySpentMap.set(exp.category, prev + exp.amountMinor);
    }

    const totalRemainingMinor = totalLimitMinor - totalSpentMinor;
    const totalUtilizationPercent = totalLimitMinor > 0 ? Math.round((totalSpentMinor / totalLimitMinor) * 100) : 0;
    const totalStatus: 'ok' | 'warning' | 'exceeded' =
      totalSpentMinor > totalLimitMinor ? 'exceeded' : totalUtilizationPercent >= 80 ? 'warning' : 'ok';

    // 4. Compute per-category statuses
    // Merge configured category budgets with any category that had spend
    const allCategories = new Set([...categoryBudgetsMap.keys(), ...categorySpentMap.keys()]);
    const categoriesStatus = Array.from(allCategories).map((category) => {
      const limitMinor = categoryBudgetsMap.get(category) ?? 0;
      const spentMinor = categorySpentMap.get(category) ?? 0;
      const remainingMinor = limitMinor - spentMinor;
      const utilizationPercent = limitMinor > 0 ? Math.round((spentMinor / limitMinor) * 100) : spentMinor > 0 ? 100 : 0;

      let status: 'ok' | 'warning' | 'exceeded' = 'ok';
      if (limitMinor > 0) {
        if (spentMinor > limitMinor) status = 'exceeded';
        else if (utilizationPercent >= 80) status = 'warning';
      }

      return {
        category,
        limitMinor,
        spentMinor,
        remainingMinor,
        utilizationPercent,
        status,
      };
    });

    return {
      month,
      total: {
        limitMinor: totalLimitMinor,
        spentMinor: totalSpentMinor,
        remainingMinor: totalRemainingMinor,
        utilizationPercent: totalUtilizationPercent,
        status: totalStatus,
      },
      categories: categoriesStatus,
    };
  });
}

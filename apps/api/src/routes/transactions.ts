import { FastifyInstance } from 'fastify';
import {
  CreateTransactionInputSchema,
  UpdateTransactionInputSchema,
  TransactionQuerySchema,
  AddCustomCategoryInputSchema,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from '@nimu/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';

export async function transactionsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /transactions
  app.get('/', async (request) => {
    const userId = request.user!.id;
    const query = TransactionQuerySchema.parse(request.query);

    const where: any = {
      userId,
      deletedAt: null,
    };

    if (query.type) where.type = query.type;
    if (query.category) where.category = query.category;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;

    if (query.minAmount !== undefined) where.amountMinor = { ...where.amountMinor, gte: query.minAmount };
    if (query.maxAmount !== undefined) where.amountMinor = { ...where.amountMinor, lte: query.maxAmount };

    if (query.q) {
      where.OR = [
        { description: { contains: query.q, mode: 'insensitive' } },
        { notes: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    // Range calculation
    const now = new Date();
    if (query.range === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      where.date = new Date(todayStr);
    } else if (query.range === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      where.date = { gte: new Date(weekAgo.toISOString().slice(0, 10)) };
    } else if (query.range === 'month') {
      const monthStart = `${now.toISOString().slice(0, 7)}-01`;
      where.date = { gte: new Date(monthStart) };
    } else if (query.from || query.to) {
      where.date = {};
      if (query.from) where.date.gte = new Date(query.from);
      if (query.to) where.date.lte = new Date(query.to);
    }

    const take = query.limit;
    const cursor = query.cursor ? { id: query.cursor } : undefined;

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: take + 1,
      cursor,
      skip: cursor ? 1 : 0,
    });

    let nextCursor: string | null = null;
    if (transactions.length > take) {
      const nextItem = transactions.pop();
      nextCursor = nextItem!.id;
    }

    return {
      transactions: transactions.map((t) => ({
        ...t,
        date: t.date.toISOString().slice(0, 10),
      })),
      nextCursor,
    };
  });

  // GET /transactions/daily (Grouped by date with per-day totals)
  app.get('/daily', async (request) => {
    const userId = request.user!.id;
    const { from, to } = request.query as { from?: string; to?: string };

    const where: any = {
      userId,
      deletedAt: null,
    };

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    // Group by day string
    const groupsMap = new Map<string, { date: string; expenseTotalMinor: number; incomeTotalMinor: number; items: any[] }>();

    for (const t of transactions) {
      const dateStr = t.date.toISOString().slice(0, 10);
      let group = groupsMap.get(dateStr);
      if (!group) {
        group = { date: dateStr, expenseTotalMinor: 0, incomeTotalMinor: 0, items: [] };
        groupsMap.set(dateStr, group);
      }

      if (t.type === 'expense') {
        group.expenseTotalMinor += t.amountMinor;
      } else {
        group.incomeTotalMinor += t.amountMinor;
      }

      group.items.push({
        ...t,
        date: dateStr,
      });
    }

    return Array.from(groupsMap.values());
  });

  // POST /transactions
  app.post('/', async (request, reply) => {
    const userId = request.user!.id;
    const body = CreateTransactionInputSchema.parse(request.body);

    // Idempotency Key Check
    if (body.idempotencyKey) {
      const existing = await prisma.transaction.findFirst({
        where: { userId, idempotencyKey: body.idempotencyKey, deletedAt: null },
      });
      if (existing) {
        return reply.status(200).send({
          ...existing,
          date: existing.date.toISOString().slice(0, 10),
        });
      }
    }

    const tx = await prisma.transaction.create({
      data: {
        userId,
        type: body.type,
        amountMinor: body.amountMinor,
        currency: body.currency,
        category: body.category,
        description: body.description,
        paymentMethod: body.paymentMethod,
        date: new Date(body.date),
        notes: body.notes,
        idempotencyKey: body.idempotencyKey || null,
      },
    });

    return reply.status(201).send({
      ...tx,
      date: tx.date.toISOString().slice(0, 10),
    });
  });

  // PATCH /transactions/:id
  app.patch('/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const body = UpdateTransactionInputSchema.parse(request.body);

    const existing = await prisma.transaction.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Transaction not found.');

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        type: body.type !== undefined ? body.type : undefined,
        amountMinor: body.amountMinor !== undefined ? body.amountMinor : undefined,
        currency: body.currency !== undefined ? body.currency : undefined,
        category: body.category !== undefined ? body.category : undefined,
        description: body.description !== undefined ? body.description : undefined,
        paymentMethod: body.paymentMethod !== undefined ? body.paymentMethod : undefined,
        date: body.date !== undefined ? new Date(body.date) : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        updatedAt: new Date(),
      },
    });

    return {
      ...updated,
      date: updated.date.toISOString().slice(0, 10),
    };
  });

  // DELETE /transactions/:id (Soft delete)
  app.delete('/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const existing = await prisma.transaction.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Transaction not found.');

    await prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Transaction deleted.' };
  });

  // ==========================================
  // CATEGORIES
  // ==========================================

  // GET /categories
  app.get('/categories', async (request) => {
    const userId = request.user!.id;
    const prefs = await prisma.preferences.findUnique({ where: { userId } });
    const financeDefaults = (prefs?.financeDefaults as any) || {};
    const enabledCategories: string[] = financeDefaults.enabledCategories || [...EXPENSE_CATEGORIES];

    return {
      expense: enabledCategories,
      income: [...INCOME_CATEGORIES],
    };
  });

  // POST /categories (Add custom category)
  app.post('/categories', async (request, reply) => {
    const userId = request.user!.id;
    const body = AddCustomCategoryInputSchema.parse(request.body);

    const prefs = await prisma.preferences.findUnique({ where: { userId } });
    const financeDefaults = (prefs?.financeDefaults as any) || {
      currency: 'INR',
      monthlyBudget: 2500000,
      enabledCategories: [...EXPENSE_CATEGORIES],
    };

    const currentCategories: string[] = financeDefaults.enabledCategories || [...EXPENSE_CATEGORIES];
    if (!currentCategories.includes(body.name)) {
      currentCategories.push(body.name);
      await prisma.preferences.update({
        where: { userId },
        data: {
          financeDefaults: {
            ...financeDefaults,
            enabledCategories: currentCategories,
          },
        },
      });
    }

    return reply.status(201).send({
      message: 'Category added.',
      categories: currentCategories,
    });
  });

  // DELETE /categories/:name
  app.delete('/categories/:name', async (request) => {
    const userId = request.user!.id;
    const { name } = request.params as { name: string };

    const prefs = await prisma.preferences.findUnique({ where: { userId } });
    const financeDefaults = (prefs?.financeDefaults as any) || {};
    const currentCategories: string[] = financeDefaults.enabledCategories || [...EXPENSE_CATEGORIES];

    const filtered = currentCategories.filter((c) => c.toLowerCase() !== name.toLowerCase());

    await prisma.preferences.update({
      where: { userId },
      data: {
        financeDefaults: {
          ...financeDefaults,
          enabledCategories: filtered,
        },
      },
    });

    return {
      message: 'Category removed.',
      categories: filtered,
    };
  });
}

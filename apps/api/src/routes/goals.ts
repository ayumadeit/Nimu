import { FastifyInstance } from 'fastify';
import {
  CreateGoalInputSchema,
  UpdateGoalInputSchema,
  GoalContributionInputSchema,
} from '@nimu/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';

export async function goalsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /goals
  app.get('/', async (request) => {
    const userId = request.user!.id;

    const goals = await prisma.savingsGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { contributions: true } },
      },
    });

    return goals.map((g) => ({
      ...g,
      targetDate: g.targetDate ? g.targetDate.toISOString().slice(0, 10) : null,
      progressPercent: g.targetMinor > 0 ? Math.min(100, Math.round((g.savedMinor / g.targetMinor) * 100)) : 0,
      contributionsCount: g._count.contributions,
    }));
  });

  // POST /goals
  app.post('/', async (request, reply) => {
    const userId = request.user!.id;
    const body = CreateGoalInputSchema.parse(request.body);

    const goal = await prisma.savingsGoal.create({
      data: {
        userId,
        name: body.name,
        targetMinor: body.targetMinor,
        savedMinor: 0,
        targetDate: body.targetDate ? new Date(body.targetDate) : null,
        icon: body.icon,
        color: body.color,
      },
    });

    return reply.status(201).send({
      ...goal,
      targetDate: goal.targetDate ? goal.targetDate.toISOString().slice(0, 10) : null,
      progressPercent: 0,
      contributionsCount: 0,
    });
  });

  // PATCH /goals/:id
  app.patch('/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const body = UpdateGoalInputSchema.parse(request.body);

    const existing = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Savings goal not found.');

    const updated = await prisma.savingsGoal.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name : undefined,
        targetMinor: body.targetMinor !== undefined ? body.targetMinor : undefined,
        targetDate: body.targetDate !== undefined ? (body.targetDate ? new Date(body.targetDate) : null) : undefined,
        icon: body.icon !== undefined ? body.icon : undefined,
        color: body.color !== undefined ? body.color : undefined,
      },
    });

    return {
      ...updated,
      targetDate: updated.targetDate ? updated.targetDate.toISOString().slice(0, 10) : null,
      progressPercent: updated.targetMinor > 0 ? Math.min(100, Math.round((updated.savedMinor / updated.targetMinor) * 100)) : 0,
    };
  });

  // DELETE /goals/:id
  app.delete('/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const existing = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Savings goal not found.');

    await prisma.savingsGoal.delete({ where: { id } });
    return { message: 'Savings goal deleted.' };
  });

  // POST /goals/:id/contributions (Deposit or withdrawal)
  app.post('/:id/contributions', async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const body = GoalContributionInputSchema.parse(request.body);

    const goal = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!goal) throw new AppError(404, 'NOT_FOUND', 'Savings goal not found.');

    const result = await prisma.$transaction(async (tx) => {
      const contribution = await tx.goalContribution.create({
        data: {
          goalId: id,
          userId,
          amountMinor: body.amountMinor,
          date: new Date(body.date),
          note: body.note,
        },
      });

      // Recalculate savedMinor sum
      const agg = await tx.goalContribution.aggregate({
        where: { goalId: id },
        _sum: { amountMinor: true },
      });
      const newSavedMinor = Math.max(0, agg._sum.amountMinor ?? 0);

      const completedAt =
        newSavedMinor >= goal.targetMinor
          ? goal.completedAt || new Date()
          : null;

      const updatedGoal = await tx.savingsGoal.update({
        where: { id },
        data: {
          savedMinor: newSavedMinor,
          completedAt,
        },
      });

      return {
        contribution: {
          ...contribution,
          date: contribution.date.toISOString().slice(0, 10),
        },
        goal: {
          ...updatedGoal,
          targetDate: updatedGoal.targetDate ? updatedGoal.targetDate.toISOString().slice(0, 10) : null,
          progressPercent: Math.min(100, Math.round((updatedGoal.savedMinor / updatedGoal.targetMinor) * 100)),
        },
      };
    });

    return reply.status(201).send(result);
  });

  // GET /goals/:id/contributions
  app.get('/:id/contributions', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const goal = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!goal) throw new AppError(404, 'NOT_FOUND', 'Savings goal not found.');

    const contributions = await prisma.goalContribution.findMany({
      where: { goalId: id, userId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    return contributions.map((c) => ({
      ...c,
      date: c.date.toISOString().slice(0, 10),
    }));
  });

  // DELETE /goals/:id/contributions/:contributionId
  app.delete('/:id/contributions/:contributionId', async (request) => {
    const userId = request.user!.id;
    const { id, contributionId } = request.params as { id: string; contributionId: string };

    const goal = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!goal) throw new AppError(404, 'NOT_FOUND', 'Savings goal not found.');

    const contribution = await prisma.goalContribution.findFirst({
      where: { id: contributionId, goalId: id, userId },
    });
    if (!contribution) throw new AppError(404, 'NOT_FOUND', 'Contribution not found.');

    await prisma.$transaction(async (tx) => {
      await tx.goalContribution.delete({ where: { id: contributionId } });

      const agg = await tx.goalContribution.aggregate({
        where: { goalId: id },
        _sum: { amountMinor: true },
      });
      const newSavedMinor = Math.max(0, agg._sum.amountMinor ?? 0);

      const completedAt =
        newSavedMinor >= goal.targetMinor
          ? goal.completedAt || new Date()
          : null;

      await tx.savingsGoal.update({
        where: { id },
        data: {
          savedMinor: newSavedMinor,
          completedAt,
        },
      });
    });

    return { message: 'Contribution removed and goal progress updated.' };
  });
}

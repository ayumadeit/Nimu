import { FastifyInstance } from 'fastify';
import { CreateRecurringRuleInputSchema } from '@nimu/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';
import { processDueRecurringRules, calculateNextRun } from '../lib/recurringCron.js';

export async function recurringRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // 1. GET /recurring
  app.get('/', async (request) => {
    const userId = request.user!.id;
    const rules = await prisma.recurringRule.findMany({
      where: { userId },
      orderBy: { nextRunAt: 'asc' },
    });
    return rules;
  });

  // 2. POST /recurring
  app.post('/', async (request, reply) => {
    const userId = request.user!.id;
    const body = CreateRecurringRuleInputSchema.parse(request.body);

    const initialDate = body.startDate ? new Date(body.startDate) : new Date();
    // Default nextRunAt: if startDate is provided in future, use it; otherwise compute next run
    const nextRunAt = body.startDate ? initialDate : calculateNextRun(initialDate, body.frequency);

    const rule = await prisma.recurringRule.create({
      data: {
        userId,
        template: body.template,
        frequency: body.frequency,
        nextRunAt,
      },
    });

    reply.status(201);
    return rule;
  });

  // 3. DELETE /recurring/:id
  app.delete('/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const rule = await prisma.recurringRule.findFirst({
      where: { id, userId },
    });

    if (!rule) {
      throw new AppError(404, 'NOT_FOUND', 'Recurring rule not found');
    }

    await prisma.recurringRule.delete({
      where: { id },
    });

    return { success: true, message: 'Recurring rule deleted' };
  });

  // 4. POST /recurring/process-due
  app.post('/process-due', async () => {
    const result = await processDueRecurringRules();
    return { success: true, ...result };
  });
}

import { FastifyInstance } from 'fastify';
import { CreateCustomThemeInputSchema, UpdateCustomThemeInputSchema } from '@nimu/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';

export async function themesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /themes
  app.get('/', async (request) => {
    const userId = request.user!.id;
    const themes = await prisma.customTheme.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return themes;
  });

  // POST /themes
  app.post('/', async (request, reply) => {
    const userId = request.user!.id;
    const body = CreateCustomThemeInputSchema.parse(request.body);

    const count = await prisma.customTheme.count({ where: { userId } });
    if (count >= 30) {
      throw new AppError(400, 'LIMIT_EXCEEDED', 'You have reached the maximum limit of 30 custom themes.');
    }

    const theme = await prisma.customTheme.create({
      data: {
        userId,
        name: body.name,
        baseThemeId: body.baseThemeId ?? null,
        light: body.light,
        dark: body.dark,
      },
    });

    return reply.status(201).send(theme);
  });

  // PATCH /themes/:id
  app.patch('/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const body = UpdateCustomThemeInputSchema.parse(request.body);

    const existing = await prisma.customTheme.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Custom theme not found.');
    }

    const updated = await prisma.customTheme.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        baseThemeId: body.baseThemeId !== undefined ? body.baseThemeId : undefined,
        light: body.light ?? undefined,
        dark: body.dark ?? undefined,
      },
    });

    return updated;
  });

  // DELETE /themes/:id
  app.delete('/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const existing = await prisma.customTheme.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Custom theme not found.');
    }

    await prisma.customTheme.delete({ where: { id } });

    // If this theme was selected in user preferences, reset to original
    const prefs = await prisma.preferences.findUnique({ where: { userId } });
    if (prefs?.themeId === id) {
      await prisma.preferences.update({
        where: { userId },
        data: { themeId: 'original' },
      });
    }

    return { message: 'Custom theme deleted successfully.' };
  });

  // POST /themes/:id/duplicate
  app.post('/:id/duplicate', async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const existing = await prisma.customTheme.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Custom theme not found.');
    }

    const count = await prisma.customTheme.count({ where: { userId } });
    if (count >= 30) {
      throw new AppError(400, 'LIMIT_EXCEEDED', 'You have reached the maximum limit of 30 custom themes.');
    }

    const duplicate = await prisma.customTheme.create({
      data: {
        userId,
        name: `${existing.name} (Copy)`,
        baseThemeId: existing.baseThemeId,
        light: existing.light as any,
        dark: existing.dark as any,
      },
    });

    return reply.status(201).send(duplicate);
  });
}

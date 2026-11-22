import { FastifyInstance } from 'fastify';
import { UpdatePreferencesInputSchema } from '@nimu/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';

export async function preferencesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /preferences
  app.get('/', async (request) => {
    const userId = request.user!.id;
    let preferences = await prisma.preferences.findUnique({
      where: { userId },
    });

    if (!preferences) {
      preferences = await prisma.preferences.create({
        data: { userId },
      });
    }

    return preferences;
  });

  // PATCH /preferences
  app.patch('/', async (request) => {
    const userId = request.user!.id;
    const body = UpdatePreferencesInputSchema.parse(request.body);

    const updateData: any = {};
    if (body.themeId !== undefined) updateData.themeId = body.themeId;
    if (body.mode !== undefined) updateData.mode = body.mode;
    if (body.sidebarCollapsed !== undefined) updateData.sidebarCollapsed = body.sidebarCollapsed;
    if (body.dashboardWidgets !== undefined) updateData.dashboardWidgets = body.dashboardWidgets;
    if (body.noteDefaults !== undefined) updateData.noteDefaults = body.noteDefaults;
    if (body.financeDefaults !== undefined) updateData.financeDefaults = body.financeDefaults;
    if (body.onboardingCompletedAt !== undefined) {
      updateData.onboardingCompletedAt = body.onboardingCompletedAt ? new Date(body.onboardingCompletedAt) : null;
    }

    const updated = await prisma.preferences.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        ...updateData,
      },
    });

    return updated;
  });
}

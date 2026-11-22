import { FastifyInstance } from 'fastify';
import {
  CreateDrawingInputSchema,
  UpdateDrawingInputSchema,
  AttachDrawingThumbnailInputSchema,
} from '@nimu/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';

export async function drawingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /drawings
  app.get('/', async (request) => {
    const userId = request.user!.id;
    const drawings = await prisma.drawing.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        title: true,
        paperType: true,
        thumbnailAssetId: true,
        width: true,
        height: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return drawings;
  });

  // POST /drawings
  app.post('/', async (request, reply) => {
    const userId = request.user!.id;
    const body = CreateDrawingInputSchema.parse(request.body);

    const drawing = await prisma.drawing.create({
      data: {
        userId,
        title: body.title,
        paperType: body.paperType,
        strokes: body.strokes as any,
        width: body.width,
        height: body.height,
        version: 1,
      },
    });

    return reply.status(201).send(drawing);
  });

  // GET /drawings/:id
  app.get('/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const drawing = await prisma.drawing.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!drawing) throw new AppError(404, 'NOT_FOUND', 'Drawing not found.');
    return drawing;
  });

  // PATCH /drawings/:id
  app.patch('/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const body = UpdateDrawingInputSchema.parse(request.body);

    const existing = await prisma.drawing.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Drawing not found.');

    if (body.version !== undefined && body.version !== existing.version) {
      throw new AppError(409, 'CONCURRENCY_CONFLICT', 'Drawing changed elsewhere.', {
        serverVersion: existing.version,
      });
    }

    const updated = await prisma.drawing.update({
      where: { id },
      data: {
        title: body.title !== undefined ? body.title : undefined,
        paperType: body.paperType !== undefined ? body.paperType : undefined,
        strokes: body.strokes !== undefined ? (body.strokes as any) : undefined,
        width: body.width !== undefined ? body.width : undefined,
        height: body.height !== undefined ? body.height : undefined,
        version: existing.version + 1,
        updatedAt: new Date(),
      },
    });

    return updated;
  });

  // DELETE /drawings/:id (Soft delete)
  app.delete('/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const existing = await prisma.drawing.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Drawing not found.');

    await prisma.drawing.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Drawing deleted.' };
  });

  // POST /drawings/:id/thumbnail
  app.post('/:id/thumbnail', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const body = AttachDrawingThumbnailInputSchema.parse(request.body);

    const existing = await prisma.drawing.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Drawing not found.');

    const updated = await prisma.drawing.update({
      where: { id },
      data: {
        thumbnailAssetId: body.thumbnailUrl || body.thumbnailDataUrl || null,
        updatedAt: new Date(),
      },
    });

    return { message: 'Thumbnail updated.', drawing: updated };
  });
}

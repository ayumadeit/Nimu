import { FastifyInstance } from 'fastify';
import {
  CreateStickyInputSchema,
  UpdateStickyInputSchema,
  BatchUpdateStickiesInputSchema,
} from '@nimu/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';

export async function stickyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // Helper to get or create default board
  async function getDefaultBoard(userId: string) {
    let board = await prisma.stickyBoard.findFirst({
      where: { userId },
    });
    if (!board) {
      board = await prisma.stickyBoard.create({
        data: { userId, name: 'Main Board' },
      });
    }
    return board;
  }

  // GET /sticky (All stickies for default board)
  app.get('/', async (request) => {
    const userId = request.user!.id;
    const board = await getDefaultBoard(userId);

    const stickies = await prisma.stickyNote.findMany({
      where: {
        userId,
        boardId: board.id,
        deletedAt: null,
      },
      orderBy: { zIndex: 'asc' },
    });

    return stickies;
  });

  // GET /sticky/pinned (Stickies pinned to dashboard)
  app.get('/pinned', async (request) => {
    const userId = request.user!.id;
    const stickies = await prisma.stickyNote.findMany({
      where: {
        userId,
        pinnedToDashboard: true,
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
    return stickies;
  });

  // POST /sticky
  app.post('/', async (request, reply) => {
    const userId = request.user!.id;
    const body = CreateStickyInputSchema.parse(request.body);
    const board = body.boardId
      ? await prisma.stickyBoard.findFirst({ where: { id: body.boardId, userId } })
      : await getDefaultBoard(userId);

    if (!board) throw new AppError(404, 'NOT_FOUND', 'Sticky board not found.');

    // Calculate max zIndex
    const maxZ = await prisma.stickyNote.aggregate({
      where: { boardId: board.id, deletedAt: null },
      _max: { zIndex: true },
    });
    const nextZ = (maxZ._max.zIndex ?? 0) + 1;

    const sticky = await prisma.stickyNote.create({
      data: {
        userId,
        boardId: board.id,
        text: body.text,
        x: body.x,
        y: body.y,
        width: body.width,
        height: body.height,
        rotation: body.rotation,
        zIndex: body.zIndex ?? nextZ,
        color: body.color,
        fontFamily: body.fontFamily,
        fontSize: body.fontSize,
        isPinned: body.isPinned,
        pinnedToDashboard: body.pinnedToDashboard,
        version: 1,
      },
    });

    return reply.status(201).send(sticky);
  });

  // PATCH /sticky/:id
  app.patch('/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const body = UpdateStickyInputSchema.parse(request.body);

    const existing = await prisma.stickyNote.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Sticky note not found.');

    if (body.version !== undefined && body.version !== existing.version) {
      throw new AppError(409, 'CONCURRENCY_CONFLICT', 'Sticky note changed elsewhere.', {
        serverVersion: existing.version,
      });
    }

    const updated = await prisma.stickyNote.update({
      where: { id },
      data: {
        text: body.text !== undefined ? body.text : undefined,
        x: body.x !== undefined ? body.x : undefined,
        y: body.y !== undefined ? body.y : undefined,
        width: body.width !== undefined ? body.width : undefined,
        height: body.height !== undefined ? body.height : undefined,
        rotation: body.rotation !== undefined ? body.rotation : undefined,
        zIndex: body.zIndex !== undefined ? body.zIndex : undefined,
        color: body.color !== undefined ? body.color : undefined,
        fontFamily: body.fontFamily !== undefined ? body.fontFamily : undefined,
        fontSize: body.fontSize !== undefined ? body.fontSize : undefined,
        isPinned: body.isPinned !== undefined ? body.isPinned : undefined,
        pinnedToDashboard: body.pinnedToDashboard !== undefined ? body.pinnedToDashboard : undefined,
        version: existing.version + 1,
        updatedAt: new Date(),
      },
    });

    return updated;
  });

  // DELETE /sticky/:id (Soft delete)
  app.delete('/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const existing = await prisma.stickyNote.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Sticky note not found.');

    await prisma.stickyNote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Sticky note deleted.' };
  });

  // POST /sticky/:id/duplicate
  app.post('/:id/duplicate', async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const existing = await prisma.stickyNote.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Sticky note not found.');

    const maxZ = await prisma.stickyNote.aggregate({
      where: { boardId: existing.boardId, deletedAt: null },
      _max: { zIndex: true },
    });

    const copy = await prisma.stickyNote.create({
      data: {
        userId,
        boardId: existing.boardId,
        text: existing.text,
        x: existing.x + 24,
        y: existing.y + 24,
        width: existing.width,
        height: existing.height,
        rotation: (existing.rotation + 2) % 15,
        zIndex: (maxZ._max.zIndex ?? 0) + 1,
        color: existing.color,
        fontFamily: existing.fontFamily,
        fontSize: existing.fontSize,
        isPinned: existing.isPinned,
        pinnedToDashboard: false,
        version: 1,
      },
    });

    return reply.status(201).send(copy);
  });

  // POST /sticky/:id/bring-to-front
  app.post('/:id/bring-to-front', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const existing = await prisma.stickyNote.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Sticky note not found.');

    const maxZ = await prisma.stickyNote.aggregate({
      where: { boardId: existing.boardId, deletedAt: null },
      _max: { zIndex: true },
    });

    const nextZ = (maxZ._max.zIndex ?? 0) + 1;
    const updated = await prisma.stickyNote.update({
      where: { id },
      data: { zIndex: nextZ, updatedAt: new Date() },
    });

    return updated;
  });

  // POST /sticky/:id/send-to-back
  app.post('/:id/send-to-back', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const existing = await prisma.stickyNote.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Sticky note not found.');

    // Shift all other stickies on this board up by 1 and set this to 1
    await prisma.$transaction(async (tx) => {
      await tx.stickyNote.updateMany({
        where: { boardId: existing.boardId, deletedAt: null, id: { not: id } },
        data: { zIndex: { increment: 1 } },
      });
      await tx.stickyNote.update({
        where: { id },
        data: { zIndex: 1, updatedAt: new Date() },
      });
    });

    return prisma.stickyNote.findUnique({ where: { id } });
  });

  // PATCH /sticky/batch (Throttled drag/size updates up to 100 stickies)
  app.patch('/batch', async (request) => {
    const userId = request.user!.id;
    const body = BatchUpdateStickiesInputSchema.parse(request.body);

    const updated = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of body.stickies) {
        const res = await tx.stickyNote.updateMany({
          where: { id: item.id, userId, deletedAt: null },
          data: {
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            rotation: item.rotation,
            zIndex: item.zIndex,
            color: item.color,
            text: item.text,
            pinnedToDashboard: item.pinnedToDashboard,
            version: { increment: 1 },
            updatedAt: new Date(),
          },
        });
        results.push({ id: item.id, updated: res.count > 0 });
      }
      return results;
    });

    return { processed: updated.length, items: updated };
  });
}

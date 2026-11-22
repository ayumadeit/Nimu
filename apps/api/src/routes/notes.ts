import { FastifyInstance } from 'fastify';
import {
  NoteQuerySchema,
  CreateNoteInputSchema,
  UpdateNoteInputSchema,
  CreateCollectionInputSchema,
  UpdateCollectionInputSchema,
  CreateTagInputSchema,
  UpdateTagInputSchema,
  MergeTagsInputSchema,
  CreateMediaUrlInputSchema,
  CreateGifInputSchema,
} from '@nimu/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errorHandler.js';
import { sanitizeTipTapNode, deriveNoteMetadata } from '../lib/tiptap.js';
import { validateMediaUrl, generateAssetStorageKey } from '../lib/media.js';
import { env } from '../config/env.js';

export async function notesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // ==========================================
  // NOTES CRUD
  // ==========================================

  // GET /notes
  app.get('/', async (request) => {
    const userId = request.user!.id;
    const query = NoteQuerySchema.parse(request.query);

    const where: any = {
      userId,
      deletedAt: null,
      isArchived: query.archived ?? false,
    };

    if (query.pinned !== undefined) where.isPinned = query.pinned;
    if (query.favorite !== undefined) where.isFavorite = query.favorite;
    if (query.collectionId) where.collectionId = query.collectionId;

    if (query.tag) {
      where.tags = {
        some: {
          tag: {
            OR: [{ id: query.tag }, { name: { equals: query.tag, mode: 'insensitive' } }],
          },
        },
      };
    }

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { plainText: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { updatedAt: 'desc' };
    if (query.sort === 'created') orderBy = { createdAt: query.order };
    if (query.sort === 'title') orderBy = { title: query.order };
    if (query.sort === 'updated') orderBy = { updatedAt: query.order };

    const take = query.limit;
    const cursor = query.cursor ? { id: query.cursor } : undefined;

    const notes = await prisma.note.findMany({
      where,
      orderBy,
      take: take + 1,
      cursor,
      skip: cursor ? 1 : 0,
      include: {
        collection: true,
        tags: {
          include: { tag: true },
        },
      },
    });

    let nextCursor: string | null = null;
    if (notes.length > take) {
      const nextItem = notes.pop();
      nextCursor = nextItem!.id;
    }

    return {
      notes: notes.map((n) => ({
        ...n,
        tags: n.tags.map((t) => t.tag),
      })),
      nextCursor,
    };
  });

  // POST /notes
  app.post('/', async (request, reply) => {
    const userId = request.user!.id;
    const body = CreateNoteInputSchema.parse(request.body);

    const sanitizedContent = sanitizeTipTapNode(body.content) || { type: 'doc', content: [] };
    const { plainText, excerpt, wordCount } = deriveNoteMetadata(sanitizedContent);

    const note = await prisma.$transaction(async (tx) => {
      const newNote = await tx.note.create({
        data: {
          userId,
          title: body.title,
          content: sanitizedContent,
          plainText,
          excerpt,
          wordCount,
          collectionId: body.collectionId || null,
          fontFamily: body.fontFamily,
          fontSize: body.fontSize,
          background: body.background,
          layout: body.layout,
          isPinned: body.isPinned,
          isFavorite: body.isFavorite,
          isArchived: body.isArchived,
          version: 1,
        },
      });

      // Associate tags
      if (body.tagIds.length > 0) {
        await tx.noteTag.createMany({
          data: body.tagIds.map((tagId) => ({
            noteId: newNote.id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }

      // Initial revision
      await tx.noteRevision.create({
        data: {
          noteId: newNote.id,
          title: newNote.title,
          content: sanitizedContent,
        },
      });

      return newNote;
    });

    const fullNote = await prisma.note.findUnique({
      where: { id: note.id },
      include: {
        collection: true,
        tags: { include: { tag: true } },
      },
    });

    return reply.status(201).send({
      ...fullNote,
      tags: fullNote!.tags.map((t) => t.tag),
    });
  });

  // GET /notes/:id
  app.get('/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const note = await prisma.note.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        collection: true,
        tags: { include: { tag: true } },
      },
    });

    if (!note) {
      throw new AppError(404, 'NOT_FOUND', 'Note not found.');
    }

    return {
      ...note,
      tags: note.tags.map((t) => t.tag),
    };
  });

  // PATCH /notes/:id (Optimistic Concurrency & Fast Autosave)
  app.patch('/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const body = UpdateNoteInputSchema.parse(request.body);

    const existing = await prisma.note.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        revisions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Note not found.');
    }

    // Check Optimistic Concurrency if client provided version
    if (body.version !== undefined && body.version !== existing.version) {
      throw new AppError(
        409,
        'CONCURRENCY_CONFLICT',
        'This note changed elsewhere. Please reload the latest version.',
        { serverVersion: existing.version }
      );
    }

    const updateData: any = {
      version: existing.version + 1,
      updatedAt: new Date(),
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.collectionId !== undefined) updateData.collectionId = body.collectionId;
    if (body.fontFamily !== undefined) updateData.fontFamily = body.fontFamily;
    if (body.fontSize !== undefined) updateData.fontSize = body.fontSize;
    if (body.background !== undefined) updateData.background = body.background;
    if (body.layout !== undefined) updateData.layout = body.layout;
    if (body.isPinned !== undefined) updateData.isPinned = body.isPinned;
    if (body.isFavorite !== undefined) updateData.isFavorite = body.isFavorite;
    if (body.isArchived !== undefined) updateData.isArchived = body.isArchived;

    let sanitizedContent = existing.content;
    if (body.content !== undefined) {
      sanitizedContent = sanitizeTipTapNode(body.content) || { type: 'doc', content: [] };
      const { plainText, excerpt, wordCount } = deriveNoteMetadata(sanitizedContent);
      updateData.content = sanitizedContent;
      updateData.plainText = plainText;
      updateData.excerpt = excerpt;
      updateData.wordCount = wordCount;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Tags update if provided
      if (body.tagIds !== undefined) {
        await tx.noteTag.deleteMany({ where: { noteId: id } });
        if (body.tagIds.length > 0) {
          await tx.noteTag.createMany({
            data: body.tagIds.map((tagId) => ({ noteId: id, tagId })),
            skipDuplicates: true,
          });
        }
      }

      // Check revision timing: write revision at most once every 2 minutes
      const lastRev = existing.revisions[0];
      const now = Date.now();
      const shouldCreateRevision =
        !lastRev || now - new Date(lastRev.createdAt).getTime() > 2 * 60 * 1000;

      if (shouldCreateRevision && (body.title !== undefined || body.content !== undefined)) {
        await tx.noteRevision.create({
          data: {
            noteId: id,
            title: body.title ?? existing.title,
            content: sanitizedContent as any,
          },
        });

        // Keep last 20 revisions per note
        const revCount = await tx.noteRevision.count({ where: { noteId: id } });
        if (revCount > 20) {
          const oldest = await tx.noteRevision.findMany({
            where: { noteId: id },
            orderBy: { createdAt: 'asc' },
            take: revCount - 20,
          });
          await tx.noteRevision.deleteMany({
            where: { id: { in: oldest.map((r) => r.id) } },
          });
        }
      }

      return tx.note.update({
        where: { id },
        data: updateData,
        include: {
          collection: true,
          tags: { include: { tag: true } },
        },
      });
    });

    return {
      id: updated.id,
      version: updated.version,
      updatedAt: updated.updatedAt.toISOString(),
      title: updated.title,
      plainText: updated.plainText,
      excerpt: updated.excerpt,
      wordCount: updated.wordCount,
      collection: updated.collection,
      tags: updated.tags.map((t) => t.tag),
    };
  });

  // DELETE /notes/:id (Soft delete)
  app.delete('/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const existing = await prisma.note.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Note not found.');
    }

    await prisma.note.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Note moved to trash.' };
  });

  // POST /notes/:id/duplicate
  app.post('/:id/duplicate', async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const existing = await prisma.note.findFirst({
      where: { id, userId, deletedAt: null },
      include: { tags: true },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Note not found.');
    }

    const duplicate = await prisma.$transaction(async (tx) => {
      const copy = await tx.note.create({
        data: {
          userId,
          collectionId: existing.collectionId,
          title: `${existing.title} (Copy)`,
          content: existing.content as any,
          plainText: existing.plainText,
          excerpt: existing.excerpt,
          wordCount: existing.wordCount,
          fontFamily: existing.fontFamily,
          fontSize: existing.fontSize,
          background: existing.background,
          layout: existing.layout,
          version: 1,
        },
      });

      if (existing.tags.length > 0) {
        await tx.noteTag.createMany({
          data: existing.tags.map((t) => ({ noteId: copy.id, tagId: t.tagId })),
        });
      }

      await tx.noteRevision.create({
        data: {
          noteId: copy.id,
          title: copy.title,
          content: copy.content as any,
        },
      });

      return copy;
    });

    return reply.status(201).send(duplicate);
  });

  // POST /notes/:id/archive & POST /notes/:id/restore
  app.post('/:id/archive', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const note = await prisma.note.updateMany({
      where: { id, userId, deletedAt: null },
      data: { isArchived: true },
    });

    if (note.count === 0) throw new AppError(404, 'NOT_FOUND', 'Note not found.');
    return { message: 'Note archived.' };
  });

  app.post('/:id/restore', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const note = await prisma.note.updateMany({
      where: { id, userId },
      data: { isArchived: false, deletedAt: null },
    });

    if (note.count === 0) throw new AppError(404, 'NOT_FOUND', 'Note not found.');
    return { message: 'Note restored.' };
  });

  // GET /notes/:id/revisions
  app.get('/:id/revisions', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const note = await prisma.note.findFirst({
      where: { id, userId },
    });
    if (!note) throw new AppError(404, 'NOT_FOUND', 'Note not found.');

    const revisions = await prisma.noteRevision.findMany({
      where: { noteId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return revisions;
  });

  // POST /notes/:id/revisions/:revisionId/restore
  app.post('/:id/revisions/:revisionId/restore', async (request) => {
    const userId = request.user!.id;
    const { id, revisionId } = request.params as { id: string; revisionId: string };

    const note = await prisma.note.findFirst({ where: { id, userId } });
    if (!note) throw new AppError(404, 'NOT_FOUND', 'Note not found.');

    const revision = await prisma.noteRevision.findFirst({
      where: { id: revisionId, noteId: id },
    });
    if (!revision) throw new AppError(404, 'NOT_FOUND', 'Revision not found.');

    const { plainText, excerpt, wordCount } = deriveNoteMetadata(revision.content);

    const updated = await prisma.note.update({
      where: { id },
      data: {
        title: revision.title,
        content: revision.content as any,
        plainText,
        excerpt,
        wordCount,
        version: note.version + 1,
        updatedAt: new Date(),
      },
    });

    return updated;
  });

  // ==========================================
  // COLLECTIONS CRUD
  // ==========================================

  app.get('/collections', async (request) => {
    const userId = request.user!.id;
    return prisma.collection.findMany({
      where: { userId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { notes: { where: { deletedAt: null } } } } },
    });
  });

  app.post('/collections', async (request, reply) => {
    const userId = request.user!.id;
    const body = CreateCollectionInputSchema.parse(request.body);

    const collection = await prisma.collection.create({
      data: {
        userId,
        name: body.name,
        color: body.color,
        icon: body.icon,
        sortOrder: body.sortOrder,
      },
    });

    return reply.status(201).send(collection);
  });

  app.patch('/collections/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const body = UpdateCollectionInputSchema.parse(request.body);

    const existing = await prisma.collection.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Collection not found.');

    return prisma.collection.update({
      where: { id },
      data: body,
    });
  });

  app.delete('/collections/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const existing = await prisma.collection.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Collection not found.');

    await prisma.collection.delete({ where: { id } });
    return { message: 'Collection deleted successfully.' };
  });

  // ==========================================
  // TAGS CRUD & MERGE
  // ==========================================

  app.get('/tags', async (request) => {
    const userId = request.user!.id;
    return prisma.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { notes: true } } },
    });
  });

  app.post('/tags', async (request, reply) => {
    const userId = request.user!.id;
    const body = CreateTagInputSchema.parse(request.body);

    const existing = await prisma.tag.findFirst({
      where: { userId, name: { equals: body.name, mode: 'insensitive' } },
    });
    if (existing) {
      return reply.status(200).send(existing);
    }

    const tag = await prisma.tag.create({
      data: {
        userId,
        name: body.name,
        color: body.color,
      },
    });

    return reply.status(201).send(tag);
  });

  app.patch('/tags/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };
    const body = UpdateTagInputSchema.parse(request.body);

    const existing = await prisma.tag.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Tag not found.');

    return prisma.tag.update({
      where: { id },
      data: body,
    });
  });

  app.delete('/tags/:id', async (request) => {
    const userId = request.user!.id;
    const { id } = request.params as { id: string };

    const existing = await prisma.tag.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Tag not found.');

    await prisma.tag.delete({ where: { id } });
    return { message: 'Tag deleted successfully.' };
  });

  app.post('/tags/merge', async (request) => {
    const userId = request.user!.id;
    const { sourceTagId, targetTagId } = MergeTagsInputSchema.parse(request.body);

    const [source, target] = await Promise.all([
      prisma.tag.findFirst({ where: { id: sourceTagId, userId } }),
      prisma.tag.findFirst({ where: { id: targetTagId, userId } }),
    ]);

    if (!source || !target) {
      throw new AppError(404, 'NOT_FOUND', 'One or both tags were not found.');
    }

    await prisma.$transaction(async (tx) => {
      // Find all notes tagged with source
      const notesWithSource = await tx.noteTag.findMany({
        where: { tagId: sourceTagId },
      });

      // Point them to target if not already tagged
      for (const item of notesWithSource) {
        const alreadyTagged = await tx.noteTag.findUnique({
          where: { noteId_tagId: { noteId: item.noteId, tagId: targetTagId } },
        });
        if (!alreadyTagged) {
          await tx.noteTag.create({
            data: { noteId: item.noteId, tagId: targetTagId },
          });
        }
      }

      // Delete source tag (cascades noteTags)
      await tx.tag.delete({ where: { id: sourceTagId } });
    });

    return { message: `Merged tag '${source.name}' into '${target.name}'.` };
  });

  // ==========================================
  // MEDIA ASSETS & GIFS
  // ==========================================

  // POST /media/upload-url
  app.post('/media/upload-url', async (request, reply) => {
    const userId = request.user!.id;
    const body = CreateMediaUrlInputSchema.parse(request.body);

    const ext = body.filename.split('.').pop() || 'bin';
    const storageKey = generateAssetStorageKey(userId, ext);

    const asset = await prisma.mediaAsset.create({
      data: {
        userId,
        noteId: body.noteId || null,
        kind: 'image',
        storageKey,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        url: `${env.API_URL}/media/${storageKey}`,
      },
    });

    // In production with S3/R2/MinIO, generate presigned PUT URL
    // Here we provide the upload URL endpoint
    return reply.status(201).send({
      assetId: asset.id,
      storageKey,
      uploadUrl: `${env.API_URL}/api/v1/notes/media/upload/${asset.id}`,
    });
  });

  // POST /media/gif
  app.post('/media/gif', async (request, reply) => {
    const userId = request.user!.id;
    const body = CreateGifInputSchema.parse(request.body);

    // Validate against SSRF
    try {
      validateMediaUrl(body.url);
    } catch (err: any) {
      throw new AppError(400, 'SSRF_BLOCKED', err.message || 'SSRF protection: Private addresses blocked');
    }

    const asset = await prisma.mediaAsset.create({
      data: {
        userId,
        noteId: body.noteId || null,
        kind: 'gif',
        storageKey: `external/${Buffer.from(body.url).toString('base64url').slice(0, 32)}`,
        url: body.url,
        mimeType: 'image/gif',
        sizeBytes: 0,
        caption: body.caption || null,
      },
    });

    return reply.status(201).send(asset);
  });
}

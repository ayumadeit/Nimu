import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import * as security from '../src/lib/security.js';

vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      note: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      noteRevision: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        deleteMany: vi.fn(),
      },
      noteTag: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      collection: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      tag: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      mediaAsset: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    },
  };
});

describe('Phase 2: Notes API & Rich Text Processing', () => {
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    token = await security.signAccessToken({ sub: 'user-123', email: 'user@example.com' });
  });

  it('POST /api/v1/notes sanitizes TipTap JSON and derives metadata', async () => {
    const tipTapContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'My Adventure' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Today I walked through the quiet pine forest with a warm thermos of tea.' },
          ],
        },
      ],
    };

    (prisma.note.create as any).mockResolvedValue({
      id: 'note-1',
      userId: 'user-123',
      title: 'Pine Forest',
      content: tipTapContent,
      plainText: 'My Adventure\nToday I walked through the quiet pine forest with a warm thermos of tea.\n',
      excerpt: 'My Adventure Today I walked through the quiet pine forest with a warm thermos of tea.',
      wordCount: 15,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    (prisma.note.findUnique as any).mockResolvedValue({
      id: 'note-1',
      title: 'Pine Forest',
      content: tipTapContent,
      tags: [],
      collection: null,
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Pine Forest',
        content: tipTapContent,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(prisma.note.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Pine Forest',
          wordCount: 16,
          version: 1,
        }),
      })
    );
  });

  it('PATCH /api/v1/notes/:id returns 409 on version conflict', async () => {
    (prisma.note.findFirst as any).mockResolvedValue({
      id: 'note-1',
      userId: 'user-123',
      version: 5, // Server has version 5
      revisions: [],
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/notes/note-1',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'New Title',
        version: 3, // Client sent outdated version 3
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('CONCURRENCY_CONFLICT');
  });

  it('POST /api/v1/notes/media/gif blocks SSRF attempts on internal IP addresses', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notes/media/gif',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        url: 'http://169.254.169.254/latest/meta-data',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('SSRF_BLOCKED');
    expect(body.error.message).toMatch(/SSRF protection/i);
  });
});

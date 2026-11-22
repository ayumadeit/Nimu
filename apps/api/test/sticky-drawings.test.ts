import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import * as security from '../src/lib/security.js';

vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      stickyBoard: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      stickyNote: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        aggregate: vi.fn(),
      },
      drawing: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    },
  };
});

describe('Phase 3: Sticky Board & Drawings API', () => {
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    token = await security.signAccessToken({ sub: 'user-123', email: 'user@example.com' });
  });

  it('GET /api/v1/sticky returns notes for default board', async () => {
    (prisma.stickyBoard.findFirst as any).mockResolvedValue({ id: 'board-1', userId: 'user-123' });
    (prisma.stickyNote.findMany as any).mockResolvedValue([
      { id: 'note-1', text: 'Water plants', zIndex: 1, color: '#FFF3B0' },
      { id: 'note-2', text: 'Call mom', zIndex: 2, color: '#F9C6D4' },
    ]);

    const app = await buildApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sticky',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveLength(2);
    expect(body[0].text).toBe('Water plants');
  });

  it('POST /api/v1/sticky/:id/bring-to-front calculates safe max zIndex', async () => {
    (prisma.stickyNote.findFirst as any).mockResolvedValue({
      id: 'note-1',
      userId: 'user-123',
      boardId: 'board-1',
      zIndex: 1,
    });
    (prisma.stickyNote.aggregate as any).mockResolvedValue({
      _max: { zIndex: 10 },
    });
    (prisma.stickyNote.update as any).mockResolvedValue({
      id: 'note-1',
      zIndex: 11,
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sticky/note-1/bring-to-front',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(prisma.stickyNote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'note-1' },
        data: expect.objectContaining({ zIndex: 11 }),
      })
    );
  });

  it('PATCH /api/v1/sticky/batch processes multiple position updates', async () => {
    (prisma.stickyNote.updateMany as any).mockResolvedValue({ count: 1 });

    const app = await buildApp();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/sticky/batch',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        stickies: [
          { id: 'note-1', x: 120, y: 150 },
          { id: 'note-2', x: 300, y: 400 },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.processed).toBe(2);
  });

  it('POST /api/v1/drawings stores vector stroke drawing', async () => {
    (prisma.drawing.create as any).mockResolvedValue({
      id: 'draw-1',
      userId: 'user-123',
      title: 'Cozy Teacup',
      paperType: 'dotted',
      strokes: [
        {
          tool: 'pen',
          color: '#6366F1',
          size: 3,
          opacity: 1,
          points: [{ x: 10, y: 20 }, { x: 15, y: 25 }],
        },
      ],
      version: 1,
    });

    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/drawings',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Cozy Teacup',
        paperType: 'dotted',
        strokes: [
          {
            tool: 'pen',
            color: '#6366F1',
            size: 3,
            opacity: 1,
            points: [{ x: 10, y: 20 }, { x: 15, y: 25 }],
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBe('draw-1');
    expect(body.paperType).toBe('dotted');
  });
});

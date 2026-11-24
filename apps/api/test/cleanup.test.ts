import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runRetentionCleanup } from '../src/lib/cleanup.js';
import { prisma } from '../src/lib/prisma.js';

vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      note: { deleteMany: vi.fn() },
      stickyNote: { deleteMany: vi.fn() },
      transaction: { deleteMany: vi.fn() },
      session: { deleteMany: vi.fn() },
      mediaAsset: { deleteMany: vi.fn() },
    },
  };
});

describe('Phase 6: Retention & Background Cleanup Jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runRetentionCleanup purges 30-day soft deleted entities and revoked sessions', async () => {
    (prisma.note.deleteMany as any).mockResolvedValue({ count: 5 });
    (prisma.stickyNote.deleteMany as any).mockResolvedValue({ count: 2 });
    (prisma.transaction.deleteMany as any).mockResolvedValue({ count: 12 });
    (prisma.session.deleteMany as any).mockResolvedValue({ count: 4 });
    (prisma.mediaAsset.deleteMany as any).mockResolvedValue({ count: 1 });

    const result = await runRetentionCleanup(30);

    expect(result.purgedNotes).toBe(5);
    expect(result.purgedStickies).toBe(2);
    expect(result.purgedTransactions).toBe(12);
    expect(result.purgedTokens).toBe(4);
    expect(result.purgedMedia).toBe(1);

    expect(prisma.note.deleteMany).toHaveBeenCalled();
    expect(prisma.stickyNote.deleteMany).toHaveBeenCalled();
    expect(prisma.transaction.deleteMany).toHaveBeenCalled();
    expect(prisma.session.deleteMany).toHaveBeenCalled();
    expect(prisma.mediaAsset.deleteMany).toHaveBeenCalled();
  });
});

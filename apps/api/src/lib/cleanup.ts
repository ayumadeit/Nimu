import { prisma } from './prisma.js';
import { logger } from './logger.js';

export interface CleanupResult {
  purgedNotes: number;
  purgedStickies: number;
  purgedTransactions: number;
  purgedTokens: number;
  purgedMedia: number;
}

/**
 * Purges soft-deleted records older than the retention window (default 30 days)
 * and revoked authentication tokens older than 7 days.
 */
export async function runRetentionCleanup(retentionDays = 30): Promise<CleanupResult> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const tokenCutoff = new Date();
  tokenCutoff.setDate(tokenCutoff.getDate() - 7);

  const mediaCutoff = new Date();
  mediaCutoff.setHours(mediaCutoff.getHours() - 24);

  logger.info({ cutoffDate, tokenCutoff }, 'Starting retention cleanup job');

  const [notes, stickies, txs, tokens, media] = await Promise.all([
    // 1. Purge notes soft-deleted > 30 days ago
    prisma.note.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lt: cutoffDate,
        },
      },
    }),

    // 2. Purge stickies soft-deleted > 30 days ago
    prisma.stickyNote.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lt: cutoffDate,
        },
      },
    }),

    // 3. Purge transactions soft-deleted > 30 days ago
    prisma.transaction.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lt: cutoffDate,
        },
      },
    }),

    // 4. Purge expired / revoked sessions > 7 days ago
    prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null, lt: tokenCutoff } },
        ],
      },
    }),

    // 5. Purge unattached media assets created > 24 hours ago
    prisma.mediaAsset.deleteMany({
      where: {
        noteId: null,
        createdAt: { lt: mediaCutoff },
      },
    }),
  ]);

  const result: CleanupResult = {
    purgedNotes: notes.count,
    purgedStickies: stickies.count,
    purgedTransactions: txs.count,
    purgedTokens: tokens.count,
    purgedMedia: media.count,
  };

  logger.info(result, 'Retention cleanup completed successfully');
  return result;
}

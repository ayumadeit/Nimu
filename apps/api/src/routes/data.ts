import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LocalStorageImportSchema } from '@nimu/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middlewares/auth.js';

const ExportQuerySchema = z.object({
  format: z.enum(['json', 'md', 'csv']).optional().default('json'),
});

export async function dataRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // 1. GET /export/notes?format=json|md
  app.get('/export/notes', async (request, reply) => {
    const userId = request.user!.id;
    const { format } = ExportQuerySchema.parse(request.query);

    const notes = await prisma.note.findMany({
      where: { userId, deletedAt: null },
      include: {
        collection: { select: { id: true, name: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (format === 'md') {
      const markdownDocs = notes.map((note) => {
        const tagNames = note.tags.map((t) => t.tag.name).join(', ');
        return `---
title: "${note.title.replace(/"/g, '\\"')}"
date: "${note.updatedAt.toISOString()}"
collection: "${note.collection?.name || 'None'}"
tags: [${tagNames}]
pinned: ${note.isPinned}
---

# ${note.title}

${note.plainText}
`;
      });

      const fullMarkdown = markdownDocs.join('\n\n---\n\n');
      reply.header('Content-Type', 'text/markdown; charset=utf-8');
      reply.header(
        'Content-Disposition',
        `attachment; filename="nimu-notes-${new Date().toISOString().slice(0, 10)}.md"`
      );
      return fullMarkdown;
    }

    return { notes };
  });

  // 2. GET /export/transactions?format=csv|json
  app.get('/export/transactions', async (request, reply) => {
    const userId = request.user!.id;
    const { format } = ExportQuerySchema.parse(request.query);

    const transactions = await prisma.transaction.findMany({
      where: { userId, deletedAt: null },
      orderBy: { date: 'desc' },
    });

    if (format === 'csv') {
      const headers = ['Date', 'Type', 'Amount (INR)', 'Category', 'Description', 'Payment Method', 'Notes'];
      const escapeCsv = (val: string | number | null | undefined) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const rows = transactions.map((t) => [
        escapeCsv(t.date.toISOString().slice(0, 10)),
        escapeCsv(t.type),
        escapeCsv((t.amountMinor / 100).toFixed(2)),
        escapeCsv(t.category),
        escapeCsv(t.description),
        escapeCsv(t.paymentMethod || 'other'),
        escapeCsv(t.notes || ''),
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header(
        'Content-Disposition',
        `attachment; filename="nimu-transactions-${new Date().toISOString().slice(0, 10)}.csv"`
      );
      return csvContent;
    }

    return {
      transactions: transactions.map((t) => ({
        ...t,
        amount: t.amountMinor / 100,
      })),
    };
  });

  // 3. GET /export/all
  app.get('/export/all', async (request, reply) => {
    const userId = request.user!.id;

    const [preferences, themes, notes, stickies, drawings, transactions, budgets, goals] =
      await Promise.all([
        prisma.preferences.findUnique({ where: { userId } }),
        prisma.customTheme.findMany({ where: { userId } }),
        prisma.note.findMany({ where: { userId, deletedAt: null }, include: { tags: { include: { tag: true } } } }),
        prisma.stickyNote.findMany({ where: { userId, deletedAt: null } }),
        prisma.drawing.findMany({ where: { userId, deletedAt: null } }),
        prisma.transaction.findMany({ where: { userId, deletedAt: null } }),
        prisma.budget.findMany({ where: { userId } }),
        prisma.savingsGoal.findMany({ where: { userId }, include: { contributions: true } }),
      ]);

    const backup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      user: { id: userId, email: request.user!.email },
      preferences,
      themes,
      notes,
      stickies,
      drawings,
      transactions,
      budgets,
      savingsGoals: goals,
    };

    reply.header('Content-Type', 'application/json');
    reply.header(
      'Content-Disposition',
      `attachment; filename="nimu-backup-${new Date().toISOString().slice(0, 10)}.json"`
    );
    return backup;
  });

  // 4. POST /import/local-storage (Idempotent client state migration)
  app.post('/import/local-storage', async (request) => {
    const userId = request.user!.id;
    const body = LocalStorageImportSchema.parse(request.body);

    let importedNotes = 0;
    let importedStickies = 0;
    let importedTransactions = 0;
    let importedGoals = 0;

    // 1. Preferences & Theme
    if (body.themeId || body.mode || body.budget) {
      await prisma.preferences.upsert({
        where: { userId },
        create: {
          userId,
          themeId: body.themeId || 'matcha',
          mode: body.mode || 'system',
          financeDefaults: {
            monthlyBudget: body.budget ? Math.round(body.budget * 100) : 2500000,
            currency: 'INR',
          },
        },
        update: {
          ...(body.themeId ? { themeId: body.themeId } : {}),
          ...(body.mode ? { mode: body.mode } : {}),
          ...(body.budget
            ? {
                financeDefaults: {
                  monthlyBudget: Math.round(body.budget * 100),
                  currency: 'INR',
                },
              }
            : {}),
        },
      });
    }

    // 2. Import Notes idempotently
    if (body.notes && body.notes.length > 0) {
      for (const rawNote of body.notes) {
        const title = (rawNote.title || 'Untitled Note').trim();
        const plainText = (rawNote.body || '').trim();

        // Check if exists
        const existing = await prisma.note.findFirst({
          where: {
            userId,
            deletedAt: null,
            title,
            plainText,
          },
        });

        if (!existing) {
          const words = plainText.split(/\s+/).filter(Boolean);
          const wordCount = words.length;
          const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
          const excerpt = plainText.slice(0, 150);
          const content = {
            type: 'doc',
            content: plainText
              ? plainText.split('\n\n').map((para) => ({
                  type: 'paragraph',
                  content: [{ type: 'text', text: para }],
                }))
              : [],
          };

          await prisma.note.create({
            data: {
              userId,
              title,
              content,
              plainText,
              excerpt,
              wordCount,
              readingTimeMinutes,
              updatedAt: rawNote.updatedAt ? new Date(rawNote.updatedAt) : new Date(),
            },
          });
          importedNotes++;
        }
      }
    }

    // 3. Import Stickies idempotently
    if (body.stickies && body.stickies.length > 0) {
      for (const rawSticky of body.stickies) {
        const text = (rawSticky.text || '').trim();
        if (!text) continue;

        const existing = await prisma.stickyNote.findFirst({
          where: {
            userId,
            deletedAt: null,
            text,
          },
        });

        if (!existing) {
          await prisma.stickyNote.create({
            data: {
              userId,
              text,
              color: rawSticky.color || '#FFF3B0',
              rotation: rawSticky.rot || 0,
              isPinned: !!rawSticky.pinned,
            },
          });
          importedStickies++;
        }
      }
    }

    // 4. Import Transactions idempotently
    if (body.txs && body.txs.length > 0) {
      for (const rawTx of body.txs) {
        const amountMinor = Math.round(Number(rawTx.amount) * 100);
        const description = (rawTx.desc || 'Transaction').trim();
        const category = (rawTx.category || 'General').trim();
        const date = new Date(rawTx.date);

        const existing = await prisma.transaction.findFirst({
          where: {
            userId,
            deletedAt: null,
            description,
            amountMinor,
            type: rawTx.type,
            date,
          },
        });

        if (!existing) {
          await prisma.transaction.create({
            data: {
              userId,
              type: rawTx.type,
              amountMinor,
              category,
              description,
              date,
              paymentMethod: rawTx.method || 'upi',
            },
          });
          importedTransactions++;
        }
      }
    }

    // 5. Import Goals idempotently
    if (body.goals && body.goals.length > 0) {
      for (const rawGoal of body.goals) {
        const name = (rawGoal.name || 'Goal').trim();
        const targetMinor = Math.round(Number(rawGoal.target) * 100);
        const savedMinor = Math.round(Number(rawGoal.saved || 0) * 100);

        const existing = await prisma.savingsGoal.findFirst({
          where: {
            userId,
            name,
          },
        });

        if (!existing) {
          await prisma.savingsGoal.create({
            data: {
              userId,
              name,
              targetMinor,
              savedMinor,
            },
          });
          importedGoals++;
        }
      }
    }

    return {
      success: true,
      message: 'Local storage data successfully migrated to your account.',
      imported: {
        notes: importedNotes,
        stickies: importedStickies,
        transactions: importedTransactions,
        goals: importedGoals,
      },
    };
  });
}

import { FastifyInstance } from 'fastify';
import { GlobalSearchQuerySchema } from '@nimu/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middlewares/auth.js';

export async function searchRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // GET /search?q=&types=&limit=
  app.get('/', async (request) => {
    const userId = request.user!.id;
    const query = GlobalSearchQuerySchema.parse(request.query);
    const q = query.q.trim();
    const limit = query.limit;

    const requestedTypes = new Set(query.types.split(',').map((t) => t.trim().toLowerCase()));

    const promises: Promise<any>[] = [];

    // 1. Search Notes
    if (requestedTypes.has('notes')) {
      promises.push(
        prisma.note.findMany({
          where: {
            userId,
            deletedAt: null,
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { plainText: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: limit,
          select: {
            id: true,
            title: true,
            plainText: true,
            excerpt: true,
            updatedAt: true,
          },
        })
      );
    } else {
      promises.push(Promise.resolve([]));
    }

    // 2. Search Transactions
    if (requestedTypes.has('transactions')) {
      promises.push(
        prisma.transaction.findMany({
          where: {
            userId,
            deletedAt: null,
            OR: [
              { description: { contains: q, mode: 'insensitive' } },
              { category: { contains: q, mode: 'insensitive' } },
              { notes: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: limit,
          select: {
            id: true,
            type: true,
            amountMinor: true,
            category: true,
            description: true,
            date: true,
          },
        })
      );
    } else {
      promises.push(Promise.resolve([]));
    }

    // 3. Search Stickies
    if (requestedTypes.has('stickies')) {
      promises.push(
        prisma.stickyNote.findMany({
          where: {
            userId,
            deletedAt: null,
            text: { contains: q, mode: 'insensitive' },
          },
          take: limit,
          select: {
            id: true,
            text: true,
            color: true,
            updatedAt: true,
          },
        })
      );
    } else {
      promises.push(Promise.resolve([]));
    }

    const [notes, transactions, stickies] = await Promise.all(promises);

    const formattedNotes = notes.map((n: any) => ({
      id: n.id,
      type: 'note',
      title: n.title || 'Untitled Note',
      snippet: n.excerpt || n.plainText.slice(0, 100),
      date: n.updatedAt.toISOString().slice(0, 10),
    }));

    const formattedTransactions = transactions.map((t: any) => ({
      id: t.id,
      type: 'transaction',
      title: t.description,
      snippet: `${t.category} · ${t.type === 'income' ? '+' : '−'}₹${t.amountMinor / 100}`,
      date: t.date.toISOString().slice(0, 10),
    }));

    const formattedStickies = stickies.map((s: any) => ({
      id: s.id,
      type: 'sticky',
      title: 'Sticky Note',
      snippet: s.text.slice(0, 100),
      color: s.color,
      date: s.updatedAt.toISOString().slice(0, 10),
    }));

    const totalMatches = formattedNotes.length + formattedTransactions.length + formattedStickies.length;

    return {
      query: q,
      totalMatches,
      results: {
        notes: formattedNotes,
        transactions: formattedTransactions,
        stickies: formattedStickies,
      },
    };
  });
}

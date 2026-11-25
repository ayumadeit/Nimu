import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordSecurityEvent } from '../src/lib/audit.js';
import { prisma } from '../src/lib/prisma.js';

vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      auditLog: {
        create: vi.fn(),
      },
    },
  };
});

describe('Phase 6: Security Audit Logging System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recordSecurityEvent persists event details to database', async () => {
    (prisma.auditLog.create as any).mockResolvedValue({ id: 'log-1' });

    await recordSecurityEvent({
      userId: 'user-audit-1',
      event: 'auth.login',
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      details: { method: 'password' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-audit-1',
        event: 'auth.login',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        details: { method: 'password' },
      },
    });
  });
});

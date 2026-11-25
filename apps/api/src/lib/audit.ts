import { prisma } from './prisma.js';
import { logger } from './logger.js';

export type SecurityEvent =
  | 'auth.login'
  | 'auth.register'
  | 'auth.token_reuse_detected'
  | 'auth.password_changed'
  | 'auth.account_deleted'
  | 'auth.logout_all';

export interface AuditLogOptions {
  userId?: string | null;
  event: SecurityEvent;
  ip?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

/**
 * Persists security events to PostgreSQL AuditLog table and outputs structured Pino log
 */
export async function recordSecurityEvent(options: AuditLogOptions): Promise<void> {
  const { userId, event, ip, userAgent, details } = options;

  logger.warn(
    {
      userId,
      event,
      ip,
      userAgent,
      details,
    },
    `Security Event: ${event}`
  );

  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        event,
        ip: ip || null,
        userAgent: userAgent || null,
        details: details || {},
      },
    });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to record audit log entry');
  }
}

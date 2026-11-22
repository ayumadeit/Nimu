import { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../lib/security.js';
import { AppError } from './errorHandler.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  sessionId?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication token required');
  }

  const token = authHeader.slice(7).trim();
  const payload = await verifyAccessToken(token);

  if (!payload || !payload.sub) {
    throw new AppError(401, 'INVALID_TOKEN', 'Access token is invalid or expired');
  }

  request.user = {
    id: payload.sub,
    email: payload.email,
    sessionId: payload.sessionId,
  };
}

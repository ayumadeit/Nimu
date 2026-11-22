import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { preferencesRoutes } from './routes/preferences.js';
import { themesRoutes } from './routes/themes.js';
import { notesRoutes } from './routes/notes.js';

export async function buildApp() {
  const app = Fastify({
    logger,
    trustProxy: true,
  });

  // Global Error Handler
  app.setErrorHandler(errorHandler);

  // Security Headers
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });

  // CORS
  await app.register(cors, {
    origin: [env.APP_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'If-Match'],
  });

  // Cookie Support
  await app.register(cookie);

  // Rate Limiting
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });

  // OpenAPI Swagger Documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Nimu API',
        description: 'Cozy personal workspace backend API (Notes, Sticky Board, Drawing Canvas, Finance)',
        version: '1.0.0',
      },
      servers: [
        {
          url: env.API_URL,
          description: 'Current environment server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Register Routes
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(preferencesRoutes, { prefix: '/api/v1/preferences' });
  await app.register(themesRoutes, { prefix: '/api/v1/themes' });
  await app.register(notesRoutes, { prefix: '/api/v1/notes' });

  return app;
}

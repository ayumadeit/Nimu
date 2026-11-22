import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';

async function start() {
  const app = await buildApp();

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await app.close();
        await prisma.$disconnect();
        logger.info('Closed all connections cleanly.');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during graceful shutdown');
        process.exit(1);
      }
    });
  }

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`Nimu API server running on ${env.API_URL}`);
    logger.info(`OpenAPI documentation available at ${env.API_URL}/docs`);
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

start();

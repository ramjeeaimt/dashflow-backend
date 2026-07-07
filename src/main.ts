import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup';
import { Logger } from '@nestjs/common';
import * as dns from 'node:dns';

const logger = new Logger('Bootstrap');

// Crash handling: log with context instead of dying silently. For truly unknown
// state (uncaughtException) exit so the process manager restarts us clean.
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled promise rejection: ${reason instanceof Error ? reason.stack : reason}`);
});
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception, shutting down: ${err.stack ?? err.message}`);
  process.exit(1);
});

async function bootstrap() {
  dns.setDefaultResultOrder('ipv4first');
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  // Close DB pools / sockets cleanly on SIGTERM/SIGINT (deploys, ctrl-c)
  app.enableShutdownHooks();

  const port = parseInt(process.env.PORT ?? '5002', 10);
  try {
    await app.listen(port);
    logger.log(`API listening on port ${port}`);
  } catch (err: any) {
    if (err?.code === 'EADDRINUSE') {
      const fallbackPort = port + 1;
      logger.warn(`Port ${port} in use, switching to ${fallbackPort}`);
      await app.listen(fallbackPort);
      logger.log(`API listening on fallback port ${fallbackPort}`);
    } else {
      throw err;
    }
  }
}

bootstrap().catch((err) => {
  logger.error(`Fatal error during bootstrap: ${err.stack ?? err}`);
  process.exit(1);
});

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { Logger } from '@nestjs/common';
import * as dns from 'node:dns';
import * as os from 'node:os';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  dns.setDefaultResultOrder('ipv4first');
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new TransformInterceptor());
  setupApp(app);

  const port = parseInt(process.env.PORT ?? '5002', 10);
  try {
    await app.listen(port);
  } catch (err: any) {
    if (err?.code === 'EADDRINUSE') {
      const fallbackPort = port + 1;
      console.warn(`Port ${port} in use, switching to ${fallbackPort}`);
      await app.listen(fallbackPort);
    } else {
      throw err;
    }
  }
}
bootstrap();


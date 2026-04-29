import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import * as dns from 'node:dns';

async function bootstrap() {

  dns.setDefaultResultOrder('ipv4first');
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new TransformInterceptor());
  setupApp(app);

  await app.listen(process.env.PORT ?? 5002);
}
bootstrap();

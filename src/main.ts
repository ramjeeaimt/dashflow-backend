import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import * as dns from 'node:dns';

async function bootstrap() {
  // Force IPv4 for database connections and other network requests
  dns.setDefaultResultOrder('ipv4first');
  
  // Allow self-signed certificates (Fixes Supabase SSL error on Render)
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const app = await NestFactory.create(AppModule);

  app.useGlobalInterceptors(new TransformInterceptor());



  setupApp(app);

  await app.listen(process.env.PORT ?? 5002);
}
bootstrap();

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

  const port = process.env.PORT ?? 5002;
  await app.listen(port, '0.0.0.0');

  const networkInterfaces = os.networkInterfaces();
  let networkIp = '';

  Object.keys(networkInterfaces).forEach((interfaceName) => {
    networkInterfaces[interfaceName]?.forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) {
        networkIp = iface.address;
      }
    });
  });

  console.log(`\n  \x1b[32m\x1b[1m➜\x1b[0m  \x1b[1mLocal:\x1b[0m   \x1b[36mhttp://localhost:${port}/api\x1b[0m`);
  if (networkIp) {
    console.log(`  \x1b[32m\x1b[1m➜\x1b[0m  \x1b[1mNetwork:\x1b[0m \x1b[36mhttp://${networkIp}:${port}/api\x1b[0m`);
  }
  console.log();
}
bootstrap();


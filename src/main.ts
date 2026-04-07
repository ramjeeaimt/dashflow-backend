import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalInterceptors(new TransformInterceptor());

  // // ✅ ADD THIS
  // app.enableCors({
  //   origin: "https://difmo-crm-frontend.vercel.app",
  //   credentials: true,
  //   methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  //   allowedHeaders: "Content-Type, Authorization",
  // });

  setupApp(app);

  await app.listen(process.env.PORT ?? 5002);
}
bootstrap();

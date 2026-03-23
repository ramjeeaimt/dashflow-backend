import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup';

let appPromise: Promise<any>;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  await app.init();
  return app.getHttpAdapter().getInstance();
}

export default async (req, res) => {
  try {
    if (!appPromise) {
      appPromise = bootstrap();
    }
    const handler = await appPromise;
    return handler(req, res);
  } catch (error) {
    console.error('SERVERLESS_BOOTSTRAP_ERROR:', error);
    res.status(500).json({
      statusCode: 500,
      message: 'Internal Server Error during bootstrap',
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  }
};

import { ValidationPipe } from '@nestjs/common';
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
  // Set CORS headers for all requests
  const allowedOrigins = [
    'https://difmo-crm-frontend.vercel.app',
    'https://difmo-crm-backend.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];

  const origin = req.headers.origin;
  const isAllowed = !origin || allowedOrigins.includes(origin) || (origin.endsWith('.vercel.app'));

  if (isAllowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://difmo-crm-frontend.vercel.app');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT,HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-HTTP-Method-Override');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
      stack: error.stack // Added for debugging
    });
  }
};

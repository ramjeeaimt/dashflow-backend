import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup';

let server: any = null;

async function bootstrap() {
  if (server) return server;
  console.log('[Serverless] Initializing Nest application...');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  setupApp(app);
  await app.init();
  server = app.getHttpAdapter().getInstance();
  console.log('[Serverless] Nest application successfully initialized');
  return server;
}

const handler = async (req: any, res: any) => {
  // Set CORS headers for all requests
  const allowedOrigins = [
    'https://dashflow-frontend.vercel.app',
    'https://dashflow-backend.vercel.app',
    'https://difmo-crm-frontend.vercel.app',
    'https://difmo-crm-backend.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
  ];

  const origin = req.headers?.origin;
  const isAllowed = !origin || allowedOrigins.includes(origin) || (origin && origin.endsWith('.vercel.app'));

  if (isAllowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin || 'https://dashflow-frontend.vercel.app');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT,HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-HTTP-Method-Override');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const appInstance = await bootstrap();
    return appInstance(req, res);
  } catch (error: any) {
    console.error('SERVERLESS_BOOTSTRAP_ERROR:', error);
    // Reset server so retry can re-attempt initialization
    server = null;
    if (!res.headersSent) {
      return res.status(500).json({
        statusCode: 500,
        message: 'Internal Server Error during serverless bootstrap',
        error: error?.message || String(error),
        stack: error?.stack,
      });
    }
  }
};

export default handler;

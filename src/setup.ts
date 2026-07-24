import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import * as yaml from 'yaml';
import * as fs from 'fs';

const STATIC_ALLOWED_ORIGINS = [
  'https://dashflow-frontend.vercel.app',
  'https://dashflow-backend.vercel.app',
  'https://difmo-crm-frontend.vercel.app',
  'https://difmo-crm-backend.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin / curl / server-to-server
  if (STATIC_ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  const extra = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (extra.includes(origin)) return true;
  return process.env.NODE_ENV !== 'production';
}

export function setupApp(app: INestApplication) {
  app.setGlobalPrefix('api');

  app.use(
    helmet({
      // Swagger UI needs relaxed CSP; API responses are JSON so CSP matters little here
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(compression());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties without decorators
      transform: true, // auto-convert payloads to DTO instances / primitives
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked for origin: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS`), false);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders:
      'Content-Type,Accept,Authorization,X-Requested-With,X-HTTP-Method-Override',
    exposedHeaders: 'Content-Range,X-Content-Range',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  const config = new DocumentBuilder()
    .setTitle('Difmo CRM API')
    .setDescription('The Difmo CRM API description')
    .setVersion('1.0')
    .addBearerAuth()
    .addServer('http://localhost:3000', 'Development')
    .addServer('https://api.difmocrm.com', 'Production')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  if (process.env.NODE_ENV !== 'production') {
    try {
      const yamlString = yaml.stringify(document, {});
      fs.writeFileSync('./swagger.yaml', yamlString);
    } catch (e) {
      console.warn('Could not write swagger.yaml', e);
    }
  }

  SwaggerModule.setup('api', app, document);
  return app;
}

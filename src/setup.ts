import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as yaml from 'yaml';
import * as fs from 'fs';

export function setupApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'https://dashflow-frontend.vercel.app',
        'https://dashflow-backend.vercel.app',
        'https://difmo-crm-frontend.vercel.app',
        'https://difmo-crm-backend.vercel.app',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'http://127.0.0.1:5173'
      ];
      
      // Allow if origin matches exactly, is a vercel subdomain, or if not in production
      const isAllowed = !origin || 
        allowedOrigins.includes(origin) || 
        origin.endsWith('.vercel.app') ||
        process.env.NODE_ENV !== 'production';
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked for origin: ${origin}`);
        callback(null, true); // Fallback to allowing during troubleshooting, or use callback(new Error('...')) for strict
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type,Accept,Authorization,X-Requested-With,X-HTTP-Method-Override',
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

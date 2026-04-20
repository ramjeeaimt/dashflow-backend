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
      // Allow development origins, and any incoming origin if not in production
      if (process.env.NODE_ENV !== 'production' || !origin) {
        callback(null, true);
        return;
      }

      // In production mode, we still want to allow localhost for local testing/debugging
      const allowedOrigins = [
        'vercel.app',
        'localhost:5173',
        'localhost:5174',
        'localhost:5175',
        'localhost:3000',
        '127.0.0.1:5173',
        '127.0.0.1:5174',
        '127.0.0.1:5175'
      ];
      
      const isAllowed = !origin || allowedOrigins.some(domain => origin.includes(domain));
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked for origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type,Accept,Authorization',
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

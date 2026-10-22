import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from '@fastify/helmet';

async function bootstrap() {
  const logger = new Logger('V-CAMS-Bootstrap');
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // Enable Cross-Origin Resource Sharing for React frontend
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3000', '*'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global prefix for all API routes
  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 V-CAMS Modular Backend Gateway is running on: http://localhost:${port}/api/v1`);
}

bootstrap();

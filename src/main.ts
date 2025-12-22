import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import multipart from '@fastify/multipart';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  app.enableShutdownHooks();

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Register Fastify multipart to handle file uploads
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  const config = new DocumentBuilder()
    .setTitle('Labels API')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: process.env.API_HEADER || 'x-api-key', in: 'header' }, 'apiKey')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '127.0.0.1');
}
bootstrap();

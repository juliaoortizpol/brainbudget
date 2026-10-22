import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const frontendUrl =
    process.env.FRONTEND_URL?.replace(/\/+$/, '') || 'http://localhost:5173';
  const isDeployedEnvironment = ['beta', 'production'].includes(
    process.env.APP_ENV || 'development',
  );

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }
  if (isDeployedEnvironment) {
    app.use(helmet());
  }

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

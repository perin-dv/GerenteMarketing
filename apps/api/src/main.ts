import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  app.enableCors({ origin: frontendUrl, credentials: true });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  console.log(`GerenteMarketing API: http://localhost:${port}`);
}

bootstrap();

import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const prefix = process.env.API_PREFIX?.trim() || "api/v1";
  app.setGlobalPrefix(prefix);

  const port = Number(process.env.PORT ?? "3000");
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`global-market-api listening on http://localhost:${port}/${prefix}`);
}

bootstrap().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

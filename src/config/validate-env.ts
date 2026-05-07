type Env = {
  PORT: number;
  API_PREFIX: string;
  MONGO_URI: string;
  MONGO_DB_NAME: string;
};

export function validateEnv(input: Record<string, unknown>): Env {
  const port = Number(input.APP_PORT ?? input.PORT ?? "3000");
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Invalid APP_PORT/PORT");
  }

  const mongoUri = String(input.MONGO_URI ?? "").trim();
  if (!mongoUri) {
    throw new Error("MONGO_URI is required");
  }

  const mongoDbName = String(input.MONGO_DB_NAME ?? "global_market").trim();
  if (!mongoDbName) {
    throw new Error("MONGO_DB_NAME is required");
  }

  const apiPrefix = String(input.API_PREFIX ?? "api/v1").trim() || "api/v1";

  return {
    PORT: port,
    API_PREFIX: apiPrefix,
    MONGO_URI: mongoUri,
    MONGO_DB_NAME: mongoDbName,
  };
}

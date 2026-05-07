import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Db, MongoClient } from "mongodb";
import { MONGO_CLIENT, MONGO_DB } from "./mongo.constants";
import { MongoService } from "./mongo.service";

@Global()
@Module({
  providers: [
    {
      provide: MONGO_CLIENT,
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<MongoClient> => {
        const uri = config.get<string>("MONGO_URI", { infer: true });
        if (!uri) {
          throw new Error("MONGO_URI is missing");
        }
        const client = new MongoClient(uri);
        await client.connect();
        return client;
      },
    },
    {
      provide: MONGO_DB,
      inject: [MONGO_CLIENT, ConfigService],
      useFactory: (client: MongoClient, config: ConfigService): Db => {
        const dbName = config.get<string>("MONGO_DB_NAME", { infer: true }) ?? "global_market";
        return client.db(dbName);
      },
    },
    MongoService,
  ],
  exports: [MONGO_CLIENT, MONGO_DB, MongoService],
})
export class MongoModule {}

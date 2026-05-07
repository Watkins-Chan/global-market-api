import { Inject, Injectable } from "@nestjs/common";
import { Collection, Db, Document, Filter, FindOptions, OptionalUnlessRequiredId, WithId } from "mongodb";
import { MONGO_DB } from "./mongo.constants";

@Injectable()
export class MongoService {
  constructor(@Inject(MONGO_DB) private readonly db: Db) {}

  collection<TSchema extends Document = Document>(name: string): Collection<TSchema> {
    return this.db.collection<TSchema>(name);
  }

  find<TSchema extends Document = Document>(
    collection: string,
    filter: Filter<TSchema>,
    options?: FindOptions<TSchema>,
  ): Promise<Array<WithId<TSchema>>> {
    return this.collection<TSchema>(collection).find(filter, options).toArray();
  }

  insertOne<TSchema extends Document = Document>(
    collection: string,
    doc: OptionalUnlessRequiredId<TSchema>,
  ): Promise<void> {
    return this.collection<TSchema>(collection)
      .insertOne(doc)
      .then(() => undefined);
  }
}

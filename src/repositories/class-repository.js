import { createClassRoom } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class ClassRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.classes,
      createEntity: createClassRoom,
      ...storage
    });
  }
}

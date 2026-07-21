import { COLLECTIONS } from "../data/schema.js";
import { createSchool } from "../data/models.js";
import { BaseRepository } from "./base-repository.js";

export class SchoolRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.schools,
      createEntity: createSchool,
      ...storage
    });
  }
}

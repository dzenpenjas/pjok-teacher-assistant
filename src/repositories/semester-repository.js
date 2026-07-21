import { createSemester } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class SemesterRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.semesters,
      createEntity: createSemester,
      ...storage
    });
  }
}

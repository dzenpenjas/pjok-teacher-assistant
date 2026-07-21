import { createStudent } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class StudentRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.students,
      createEntity: createStudent,
      ...storage
    });
  }
}

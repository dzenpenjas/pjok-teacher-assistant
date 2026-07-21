import { createTeacher } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class TeacherRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.teachers,
      createEntity: createTeacher,
      ...storage
    });
  }
}

import { createStudentTag } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class TagRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.studentTags,
      createEntity: createStudentTag,
      ...storage
    });
  }
}

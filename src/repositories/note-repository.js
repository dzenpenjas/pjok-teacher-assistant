import { createStudentNote } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class NoteRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.studentNotes,
      createEntity: createStudentNote,
      ...storage
    });
  }
}

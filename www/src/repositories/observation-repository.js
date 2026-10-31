import { createStudentObservation } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class ObservationRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.studentObservations,
      createEntity: createStudentObservation,
      ...storage
    });
  }

  findByStudent(studentId) {
    return this.list().filter((obs) => obs.studentId === studentId);
  }

  findBySession(sessionId) {
    return this.list().filter((obs) => obs.sessionId === sessionId);
  }
}

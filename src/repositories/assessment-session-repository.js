import { createAssessmentSession } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class AssessmentSessionRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.assessmentSessions,
      createEntity: createAssessmentSession,
      ...storage
    });
  }

  findBySession(sessionId) {
    return this.list().filter((as) => as.sessionId === sessionId);
  }

  findByClass(classId) {
    return this.list().filter((as) => as.classId === classId);
  }
}

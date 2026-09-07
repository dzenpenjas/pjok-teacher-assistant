import { createAssessmentResult } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class AssessmentResultRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.assessmentResults,
      createEntity: createAssessmentResult,
      ...storage
    });
  }

  findByAssessmentSession(assessmentSessionId) {
    return this.list().filter((res) => res.assessmentSessionId === assessmentSessionId);
  }

  findBySession(sessionId) {
    return this.list().filter((res) => res.sessionId === sessionId);
  }

  findByStudent(studentId) {
    return this.list().filter((res) => res.studentId === studentId);
  }

  findBySessionAndStudent(sessionId, studentId) {
    return this.list().find((res) => res.sessionId === sessionId && res.studentId === studentId) || null;
  }
}

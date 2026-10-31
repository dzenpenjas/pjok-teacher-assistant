import { createAttendanceRecord } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class AttendanceRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.attendanceRecords,
      createEntity: createAttendanceRecord,
      ...storage
    });
  }

  findBySession(sessionId) {
    return this.list().filter((record) => record.sessionId === sessionId);
  }

  findBySessionAndStudent(sessionId, studentId) {
    return this.list().find(
      (record) => record.sessionId === sessionId && record.studentId === studentId
    ) || null;
  }
}

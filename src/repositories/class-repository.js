import { createClassRoom } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class ClassRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.classes,
      createEntity: createClassRoom,
      ...storage
    });
  }

  getActiveClasses() {
    return this.list().filter((c) => c.status !== "archived");
  }

  archiveClass(classId) {
    const state = this.loadState();
    const classes = (state.classes || []).map((c) =>
      c.id === classId ? { ...c, status: "archived" } : c
    );
    // Deactivate schedules associated with this class
    const schedules = (state.schedules || []).map((s) =>
      s.classId === classId ? { ...s, active: false } : s
    );
    const nextState = {
      ...state,
      classes,
      schedules
    };
    this.saveState(nextState);
    return classes.find((c) => c.id === classId) || null;
  }

  delete(classId) {
    return this.deleteCascade(classId);
  }

  deleteCascade(classId) {
    const state = this.loadState();
    const classes = (state.classes || []).filter((c) => c.id !== classId);
    const studentsToDelete = (state.students || []).filter((s) => s.classId === classId);
    const studentIdsToDelete = new Set(studentsToDelete.map((s) => s.id));
    const students = (state.students || []).filter((s) => !studentIdsToDelete.has(s.id));

    const sessionsToDelete = (state.sessions || []).filter((sess) => sess.classId === classId);
    const sessionIdsToDelete = new Set(sessionsToDelete.map((sess) => sess.id));
    const sessions = (state.sessions || []).filter((sess) => !sessionIdsToDelete.has(sess.id));

    const attendanceRecords = (state.attendanceRecords || []).filter(
      (r) => !studentIdsToDelete.has(r.studentId) && !sessionIdsToDelete.has(r.sessionId)
    );
    const assessmentResults = (state.assessmentResults || []).filter(
      (r) => !studentIdsToDelete.has(r.studentId) && !sessionIdsToDelete.has(r.sessionId)
    );
    const growthRecords = (state.growthRecords || []).filter(
      (r) => !studentIdsToDelete.has(r.studentId)
    );
    const studentObservations = (state.studentObservations || []).filter(
      (r) => !studentIdsToDelete.has(r.studentId) && !sessionIdsToDelete.has(r.sessionId)
    );
    const studentNotes = (state.studentNotes || []).filter(
      (r) => !studentIdsToDelete.has(r.studentId)
    );
    const sessionActivities = (state.sessionActivities || []).filter(
      (a) => !sessionIdsToDelete.has(a.sessionId)
    );
    const assessmentSessions = (state.assessmentSessions || []).filter(
      (as) => as.classId !== classId && !sessionIdsToDelete.has(as.sessionId)
    );

    const nextState = {
      ...state,
      classes,
      students,
      sessions,
      attendanceRecords,
      assessmentResults,
      growthRecords,
      studentObservations,
      studentNotes,
      sessionActivities,
      assessmentSessions
    };
    this.saveState(nextState);
    return classes;
  }
}

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

  getArchivedClasses() {
    return this.list().filter((c) => c.status === "archived");
  }

  archiveClass(classId) {
    const state = this.loadState();
    const targetClass = (state.classes || []).find((c) => c.id === classId);
    if (!targetClass) {
      return { success: false, data: null, error: new Error("Kelas tidak ditemukan.") };
    }
    const classes = (state.classes || []).map((c) =>
      c.id === classId ? { ...c, status: "archived", updatedAt: new Date().toISOString() } : c
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
    const result = this.saveState(nextState);
    const saveSuccess = result && result.success !== undefined ? result.success : true;
    const updatedClass = classes.find((c) => c.id === classId) || null;
    return {
      success: saveSuccess,
      data: updatedClass,
      error: result?.error
    };
  }

  restoreClass(classId) {
    const state = this.loadState();
    const targetClass = (state.classes || []).find((c) => c.id === classId);
    if (!targetClass) {
      return { success: false, data: null, error: new Error("Kelas tidak ditemukan.") };
    }
    const classes = (state.classes || []).map((c) =>
      c.id === classId ? { ...c, status: "active", updatedAt: new Date().toISOString() } : c
    );
    // Do not automatically reactivate old schedules per requirements
    const nextState = {
      ...state,
      classes
    };
    const result = this.saveState(nextState);
    const saveSuccess = result && result.success !== undefined ? result.success : true;
    const updatedClass = classes.find((c) => c.id === classId) || null;
    return {
      success: saveSuccess,
      data: updatedClass,
      error: result?.error
    };
  }

  delete(classId) {
    return this.deleteCascade(classId);
  }

  deleteCascade(classId) {
    const state = this.loadState();
    const targetClass = (state.classes || []).find((c) => c.id === classId);
    if (!targetClass) {
      return { success: false, data: null, error: new Error("Kelas tidak ditemukan.") };
    }

    const classes = (state.classes || []).filter((c) => c.id !== classId);
    const studentsToDelete = (state.students || []).filter((s) => s.classId === classId);
    const studentIdsToDelete = new Set(studentsToDelete.map((s) => s.id));
    const students = (state.students || []).filter((s) => !studentIdsToDelete.has(s.id));

    const sessionsToDelete = (state.sessions || []).filter((sess) => sess.classId === classId);
    const sessionIdsToDelete = new Set(sessionsToDelete.map((sess) => sess.id));
    const sessions = (state.sessions || []).filter((sess) => !sessionIdsToDelete.has(sess.id));

    const assessmentSessionsToDelete = (state.assessmentSessions || []).filter(
      (as) => as.classId === classId || sessionIdsToDelete.has(as.sessionId)
    );
    const assessmentSessionIdsToDelete = new Set(assessmentSessionsToDelete.map((as) => as.id));
    const assessmentSessions = (state.assessmentSessions || []).filter(
      (as) => as.classId !== classId && !sessionIdsToDelete.has(as.sessionId) && !assessmentSessionIdsToDelete.has(as.id)
    );

    const attendanceRecords = (state.attendanceRecords || []).filter(
      (r) => !studentIdsToDelete.has(r.studentId) && !sessionIdsToDelete.has(r.sessionId) && r.classId !== classId
    );
    const assessmentResults = (state.assessmentResults || []).filter(
      (r) =>
        !studentIdsToDelete.has(r.studentId) &&
        !sessionIdsToDelete.has(r.sessionId) &&
        !assessmentSessionIdsToDelete.has(r.assessmentSessionId) &&
        r.classId !== classId
    );
    const growthRecords = (state.growthRecords || []).filter(
      (r) => !studentIdsToDelete.has(r.studentId) && r.classId !== classId
    );
    const studentObservations = (state.studentObservations || []).filter(
      (r) => !studentIdsToDelete.has(r.studentId) && !sessionIdsToDelete.has(r.sessionId) && r.classId !== classId
    );
    const studentNotes = (state.studentNotes || []).filter(
      (r) => !studentIdsToDelete.has(r.studentId)
    );
    const studentReports = (state.studentReports || []).filter(
      (r) => !studentIdsToDelete.has(r.studentId) && r.classId !== classId
    );
    const schedules = (state.schedules || []).filter(
      (s) => s.classId !== classId
    );
    const sessionActivities = (state.sessionActivities || []).filter(
      (a) => !sessionIdsToDelete.has(a.sessionId)
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
      studentReports,
      schedules,
      sessionActivities,
      assessmentSessions
    };
    const result = this.saveState(nextState);
    const saveSuccess = result && result.success !== undefined ? result.success : true;

    return {
      success: saveSuccess,
      data: saveSuccess ? targetClass : null,
      classes,
      error: result?.error
    };
  }
}

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

  findByClass(classId) {
    return this.list().filter((student) => student.classId === classId);
  }

  delete(studentId) {
    return this.deleteCascade(studentId);
  }

  deleteCascade(studentId) {
    const state = this.loadState();
    const student = (state.students || []).find(s => s.id === studentId);
    if (!student) {
      return { success: false, data: null, error: new Error("Siswa tidak ditemukan.") };
    }

    const students = (state.students || []).filter((s) => s.id !== studentId);
    const attendanceRecords = (state.attendanceRecords || []).filter((r) => r.studentId !== studentId);
    const assessmentResults = (state.assessmentResults || []).filter((r) => r.studentId !== studentId);
    const growthRecords = (state.growthRecords || []).filter((r) => r.studentId !== studentId);
    const studentObservations = (state.studentObservations || []).filter((r) => r.studentId !== studentId);
    const studentNotes = (state.studentNotes || []).filter((r) => r.studentId !== studentId);
    const studentReports = (state.studentReports || []).filter((r) => r.studentId !== studentId);

    const nextState = {
      ...state,
      students,
      attendanceRecords,
      assessmentResults,
      growthRecords,
      studentObservations,
      studentNotes,
      studentReports
    };
    const result = this.saveState(nextState);
    
    return {
      success: result.success,
      data: result.success ? student : null,
      error: result.error
    };
  }
}

import { loadState, saveState } from "../storage/storage.js";
import { AcademicYearRepository } from "./academic-year-repository.js";
import { ClassRepository } from "./class-repository.js";
import { NoteRepository } from "./note-repository.js";
import { AttendanceRepository } from "./attendance-repository.js";
import { SchoolRepository } from "./school-repository.js";
import { SemesterRepository } from "./semester-repository.js";
import { SessionRepository } from "./session-repository.js";
import { StudentRepository } from "./student-repository.js";
import { TagRepository } from "./tag-repository.js";
import { TeacherRepository } from "./teacher-repository.js";

export function createRepositoryContext() {
  const storage = {
    loadState,
    saveState
  };

  return {
    schools: new SchoolRepository(storage),
    academicYears: new AcademicYearRepository(storage),
    semesters: new SemesterRepository(storage),
    teachers: new TeacherRepository(storage),
    classes: new ClassRepository(storage),
    sessions: new SessionRepository(storage),
    attendanceRecords: new AttendanceRepository(storage),
    students: new StudentRepository(storage),
    tags: new TagRepository(storage),
    notes: new NoteRepository(storage)
  };
}

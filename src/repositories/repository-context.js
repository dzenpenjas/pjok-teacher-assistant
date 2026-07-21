import { loadState, saveState } from "../storage/storage.js";
import { AcademicYearRepository } from "./academic-year-repository.js";
import { ClassRepository } from "./class-repository.js";
import { NoteRepository } from "./note-repository.js";
import { SchoolRepository } from "./school-repository.js";
import { SemesterRepository } from "./semester-repository.js";
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
    students: new StudentRepository(storage),
    tags: new TagRepository(storage),
    notes: new NoteRepository(storage)
  };
}

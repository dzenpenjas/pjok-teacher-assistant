export function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

function withMeta(entity, prefix) {
  const timestamp = nowIso();
  return {
    id: entity.id || createId(prefix),
    createdAt: entity.createdAt || timestamp,
    updatedAt: timestamp
  };
}

export function createSchool(input = {}) {
  return {
    ...withMeta(input, "school"),
    name: input.name || "",
    address: input.address || "",
    phone: input.phone || ""
  };
}

export function createAcademicYear(input = {}) {
  return {
    ...withMeta(input, "year"),
    name: input.name || "",
    startsAt: input.startsAt || "",
    endsAt: input.endsAt || "",
    isActive: Boolean(input.isActive)
  };
}

export function createSemester(input = {}) {
  return {
    ...withMeta(input, "semester"),
    name: input.name || "",
    academicYearId: input.academicYearId || "",
    isActive: Boolean(input.isActive)
  };
}

export function createTeacher(input = {}) {
  return {
    ...withMeta(input, "teacher"),
    name: input.name || "",
    employeeNumber: input.employeeNumber || "",
    phone: input.phone || "",
    schoolId: input.schoolId || ""
  };
}

export function createClassRoom(input = {}) {
  return {
    ...withMeta(input, "class"),
    name: input.name || "",
    grade: input.grade || "",
    academicYearId: input.academicYearId || "",
    teacherId: input.teacherId || ""
  };
}

export function createStudent(input = {}) {
  return {
    ...withMeta(input, "student"),
    name: input.name || "",
    studentNumber: input.studentNumber || "",
    gender: input.gender || "",
    classId: input.classId || "",
    photo: input.photo || "",
    birthDate: input.birthDate || "",
    heightCm: input.heightCm || "",
    weightKg: input.weightKg || "",
    noteIds: Array.isArray(input.noteIds) ? input.noteIds : [],
    tagIds: Array.isArray(input.tagIds) ? input.tagIds : []
  };
}

export function createStudentNote(input = {}) {
  return {
    ...withMeta(input, "note"),
    studentId: input.studentId || "",
    text: input.text || ""
  };
}

export function createStudentTag(input = {}) {
  return {
    ...withMeta(input, "tag"),
    name: input.name || "",
    color: input.color || "#116149"
  };
}

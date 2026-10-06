import { loadState, replaceState } from "./storage.js";

export function exportStateAsJson() {
  return JSON.stringify(loadState(), null, 2);
}

export function inspectBackupJson(jsonText) {
  if (!jsonText || typeof jsonText !== "string") {
    return { valid: false, error: "Format file tidak valid atau data kosong." };
  }

  let parsedState;
  try {
    parsedState = JSON.parse(jsonText);
  } catch {
    return { valid: false, error: "File tidak berformat JSON yang valid." };
  }

  if (!parsedState || typeof parsedState !== "object" || Array.isArray(parsedState)) {
    return { valid: false, error: "Struktur data backup harus berupa object JSON." };
  }

  const recognizableKeys = [
    "classes",
    "students",
    "schools",
    "teachers",
    "sessions",
    "schemaVersion",
    "academicYears",
    "assessmentDefinitions"
  ];
  const hasRecognizableKey = recognizableKeys.some((k) => k in parsedState);
  if (!hasRecognizableKey) {
    return { valid: false, error: "File JSON tidak dikenali sebagai data cadangan PJOK Teacher Assistant." };
  }

  const getArrayCount = (key) => (Array.isArray(parsedState[key]) ? parsedState[key].length : 0);

  const summary = {
    schools: Array.isArray(parsedState.schools) ? parsedState.schools.length : (parsedState.schools ? 1 : 0),
    teachers: Array.isArray(parsedState.teachers) ? parsedState.teachers.length : (parsedState.teachers ? 1 : 0),
    academicYears: getArrayCount("academicYears"),
    semesters: getArrayCount("semesters"),
    classes: getArrayCount("classes"),
    students: getArrayCount("students"),
    studentNotes: getArrayCount("studentNotes"),
    studentTags: getArrayCount("studentTags"),
    sessions: getArrayCount("sessions"),
    schedules: getArrayCount("schedules"),
    attendanceRecords: getArrayCount("attendanceRecords"),
    sessionActivities: getArrayCount("sessionActivities"),
    assessmentDefinitions: getArrayCount("assessmentDefinitions"),
    assessmentSessions: getArrayCount("assessmentSessions"),
    assessmentResults: getArrayCount("assessmentResults"),
    growthRecords: getArrayCount("growthRecords"),
    studentObservations: getArrayCount("studentObservations")
  };

  // Check for orphan references (report warnings only, do not delete)
  const warnings = [];
  const studentsList = Array.isArray(parsedState.students) ? parsedState.students : [];
  const studentIdSet = new Set(studentsList.map((s) => s && s.id).filter(Boolean));

  const orphanChecks = [
    { key: "studentNotes", label: "Catatan Siswa (studentNotes)" },
    { key: "growthRecords", label: "Catatan Pertumbuhan (growthRecords)" },
    { key: "attendanceRecords", label: "Rekap Presensi (attendanceRecords)" },
    { key: "assessmentResults", label: "Hasil Asesmen (assessmentResults)" },
    { key: "studentObservations", label: "Observasi Siswa (studentObservations)" }
  ];

  orphanChecks.forEach(({ key, label }) => {
    const list = parsedState[key];
    if (Array.isArray(list)) {
      const orphanCount = list.filter((item) => item && item.studentId && !studentIdSet.has(item.studentId)).length;
      if (orphanCount > 0) {
        warnings.push(`Terdapat ${orphanCount} data pada ${label} dengan studentId yang tidak ditemukan di daftar siswa.`);
      }
    }
  });

  return {
    valid: true,
    data: parsedState,
    summary,
    warnings
  };
}

export function importStateFromJson(jsonText) {
  const check = inspectBackupJson(jsonText);
  if (!check.valid) {
    return {
      success: false,
      state: null,
      error: new Error(check.error)
    };
  }
  return replaceState(check.data);
}

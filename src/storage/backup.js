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

  const recognizableKeys = ["classes", "students", "schools", "teachers", "sessions", "schemaVersion"];
  const hasRecognizableKey = recognizableKeys.some((k) => k in parsedState);
  if (!hasRecognizableKey) {
    return { valid: false, error: "File JSON tidak dikenali sebagai data cadangan PJOK Teacher Assistant." };
  }

  return {
    valid: true,
    data: parsedState,
    summary: {
      schools: Array.isArray(parsedState.schools) ? parsedState.schools.length : (parsedState.schools ? 1 : 0),
      teachers: Array.isArray(parsedState.teachers) ? parsedState.teachers.length : (parsedState.teachers ? 1 : 0),
      classes: Array.isArray(parsedState.classes) ? parsedState.classes.length : 0,
      students: Array.isArray(parsedState.students) ? parsedState.students.length : 0,
      sessions: Array.isArray(parsedState.sessions) ? parsedState.sessions.length : 0,
      attendanceRecords: Array.isArray(parsedState.attendanceRecords) ? parsedState.attendanceRecords.length : 0,
      assessmentResults: Array.isArray(parsedState.assessmentResults) ? parsedState.assessmentResults.length : 0
    }
  };
}

export function importStateFromJson(jsonText) {
  const check = inspectBackupJson(jsonText);
  if (!check.valid) {
    throw new Error(check.error);
  }
  return replaceState(check.data);
}

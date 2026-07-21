export const APP_SCHEMA_VERSION = 2;

export const SCREENS = {
  dashboard: "dashboard",
  masterData: "master-data",
  session: "session",
  settings: "settings"
};

export const COLLECTIONS = {
  schools: "schools",
  academicYears: "academicYears",
  semesters: "semesters",
  teachers: "teachers",
  classes: "classes",
  students: "students",
  studentNotes: "studentNotes",
  studentTags: "studentTags",
  sessions: "sessions"
};

export const DEFAULT_APP_STATE = {
  schemaVersion: APP_SCHEMA_VERSION,
  currentScreen: SCREENS.dashboard,
  activeSessionId: null,
  schools: [],
  academicYears: [],
  semesters: [],
  teachers: [],
  classes: [],
  students: [],
  studentNotes: [],
  studentTags: [],
  sessions: [],
  updatedAt: null
};

export function createInitialState() {
  return {
    ...DEFAULT_APP_STATE,
    schools: [],
    academicYears: [],
    semesters: [],
    teachers: [],
    classes: [],
    students: [],
    studentNotes: [],
    studentTags: [],
    sessions: [],
    updatedAt: new Date().toISOString()
  };
}

import { APP_SCHEMA_VERSION, COLLECTIONS, createInitialState } from "../data/schema.js";
import { createSeedData } from "../data/seed.js";

const STORAGE_KEY = "pjokTeacherAssistant.state";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function migrateState(rawState) {
  const state = { ...rawState };
  const currentVersion = Number(state.schemaVersion) || 1;

  if (currentVersion < 4) {
    const seed = createSeedData();

    state.sessionActivities = Array.isArray(state.sessionActivities) ? state.sessionActivities : [];
    state.assessmentDefinitions = Array.isArray(state.assessmentDefinitions) ? state.assessmentDefinitions : [];
    state.assessmentSessions = Array.isArray(state.assessmentSessions) ? state.assessmentSessions : [];
    state.assessmentResults = Array.isArray(state.assessmentResults) ? state.assessmentResults : [];
    state.growthRecords = Array.isArray(state.growthRecords) ? state.growthRecords : [];
    state.studentObservations = Array.isArray(state.studentObservations) ? state.studentObservations : [];

    if (state.assessmentDefinitions.length === 0 && Array.isArray(seed.assessmentDefinitions)) {
      state.assessmentDefinitions = [...seed.assessmentDefinitions];
    }

    if (Array.isArray(state.students) && state.growthRecords.length === 0) {
      const initialGrowth = [];
      state.students.forEach((student) => {
        if (student.heightCm || student.weightKg) {
          initialGrowth.push({
            id: `growth-migrated-${student.id}`,
            studentId: student.id,
            date: student.createdAt ? student.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
            heightCm: String(student.heightCm || ""),
            weightKg: String(student.weightKg || ""),
            bmi: null,
            bmiCategory: "-",
            note: "Data awal profil siswa",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      });
      if (initialGrowth.length > 0) {
        state.growthRecords = initialGrowth;
      }
    }

    state.schemaVersion = 4;
  }

  if (currentVersion < 5) {
    state.schedules = Array.isArray(state.schedules) ? state.schedules : [];
    if (!state.activeAcademicYearId && Array.isArray(state.academicYears)) {
      const activeYear = state.academicYears.find((y) => y.isActive);
      state.activeAcademicYearId = activeYear ? activeYear.id : (state.academicYears[0]?.id || null);
    }
    if (!state.activeSemesterId && Array.isArray(state.semesters)) {
      const activeSem = state.semesters.find((s) => s.isActive);
      state.activeSemesterId = activeSem ? activeSem.id : (state.semesters[0]?.id || null);
    }
    state.schemaVersion = 5;
  }

  return state;
}

export function normalizeState(state) {
  if (!isPlainObject(state)) {
    return createInitialState();
  }

  const migrated = migrateState(state);

  const nextState = {
    ...createInitialState(),
    ...migrated,
    schemaVersion: APP_SCHEMA_VERSION,
    updatedAt: migrated.updatedAt || new Date().toISOString()
  };

  Object.values(COLLECTIONS).forEach((collectionName) => {
    nextState[collectionName] = Array.isArray(migrated[collectionName])
      ? migrated[collectionName]
      : [];
  });

  // Invariant 1: Singleton School - at most 1 school
  if (nextState.schools.length > 1) {
    nextState.schools = [nextState.schools[0]];
  }

  // Invariant 2: Singleton Teacher - at most 1 teacher
  if (nextState.teachers.length > 1) {
    nextState.teachers = [nextState.teachers[0]];
  }

  // Invariant 3: Single Active Session - at most 1 active session
  const activeSessions = (nextState.sessions || []).filter((s) => s.status === "active");
  if (activeSessions.length > 1) {
    const keepActiveId = activeSessions[activeSessions.length - 1].id;
    nextState.sessions = nextState.sessions.map((s) => {
      if (s.status === "active" && s.id !== keepActiveId) {
        return { ...s, status: "paused" };
      }
      return s;
    });
  }

  // Map legacy master-data screen to classes
  if (nextState.currentScreen === "master-data") {
    nextState.currentScreen = "classes";
  }

  return nextState;
}

export function loadState() {
  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY);
    return normalizeState(rawState ? JSON.parse(rawState) : null);
  } catch (error) {
    console.warn("Gagal membaca data lokal. State baru digunakan.", error);
    return createInitialState();
  }
}

export function saveState(state) {
  const nextState = normalizeState({
    ...state,
    updatedAt: new Date().toISOString()
  });

  let success = true;
  let saveError = null;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch (error) {
    success = false;
    saveError = error;
    if (error.name === "QuotaExceededError" || error.code === 22) {
      console.error("Local Storage kuota hampir penuh saat menyimpan data.", error);
      if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert("Peringatan: Penyimpanan lokal browser hampir penuh. Silakan ekspor cadangan data di menu Pengaturan.");
      }
    } else {
      console.error("Gagal menyimpan data ke Local Storage:", error);
    }
  }

  Object.assign(nextState, {
    success,
    error: saveError
  });

  return nextState;
}

export function replaceState(state) {
  const nextState = normalizeState(state);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch (error) {
    if (error.name === "QuotaExceededError" || error.code === 22) {
      console.error("Local Storage kuota hampir penuh saat memulihkan data.", error);
      if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert("Peringatan: Penyimpanan lokal browser hampir penuh. Data tidak dapat disimpan sepenuhnya.");
      }
    } else {
      console.error("Gagal memperbarui data ke Local Storage:", error);
    }
  }
  return nextState;
}

export function getStorageKey() {
  return STORAGE_KEY;
}

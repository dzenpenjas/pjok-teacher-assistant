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

  return state;
}

function normalizeState(state) {
  if (!isPlainObject(state)) {
    return {
      ...createInitialState(),
      ...createSeedData()
    };
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

  const hasMasterData = Object.values(COLLECTIONS).some(
    (collectionName) => nextState[collectionName].length > 0
  );

  if (!hasMasterData) {
    return {
      ...nextState,
      ...createSeedData()
    };
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

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  return nextState;
}

export function replaceState(state) {
  const nextState = normalizeState(state);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  return nextState;
}

export function getStorageKey() {
  return STORAGE_KEY;
}

import { APP_SCHEMA_VERSION, COLLECTIONS, createInitialState } from "../data/schema.js";
import { createSeedData } from "../data/seed.js";

const STORAGE_KEY = "pjokTeacherAssistant.state";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeState(state) {
  if (!isPlainObject(state)) {
    return {
      ...createInitialState(),
      ...createSeedData()
    };
  }

  const nextState = {
    ...createInitialState(),
    ...state,
    schemaVersion: APP_SCHEMA_VERSION,
    updatedAt: state.updatedAt || new Date().toISOString()
  };

  Object.values(COLLECTIONS).forEach((collectionName) => {
    nextState[collectionName] = Array.isArray(state[collectionName])
      ? state[collectionName]
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

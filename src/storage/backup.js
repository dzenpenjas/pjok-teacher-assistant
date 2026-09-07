import { loadState, replaceState } from "./storage.js";

export function exportStateAsJson() {
  return JSON.stringify(loadState(), null, 2);
}

export function importStateFromJson(jsonText) {
  if (!jsonText || typeof jsonText !== "string") {
    throw new Error("Format file tidak valid atau data kosong.");
  }

  let parsedState;
  try {
    parsedState = JSON.parse(jsonText);
  } catch {
    throw new Error("File tidak berformat JSON yang valid.");
  }

  if (!parsedState || typeof parsedState !== "object" || Array.isArray(parsedState)) {
    throw new Error("Struktur data backup harus berupa object JSON.");
  }

  // Basic integrity check: at least must look like a PJOK Teacher Assistant backup
  const recognizableKeys = ["classes", "students", "schools", "sessions", "schemaVersion"];
  const hasRecognizableKey = recognizableKeys.some((k) => k in parsedState);
  if (!hasRecognizableKey) {
    throw new Error("File JSON tidak dikenali sebagai data cadangan PJOK Teacher Assistant.");
  }

  return replaceState(parsedState);
}

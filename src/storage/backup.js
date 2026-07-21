import { loadState, replaceState } from "./storage.js";

export function exportStateAsJson() {
  return JSON.stringify(loadState(), null, 2);
}

export function importStateFromJson(jsonText) {
  const parsedState = JSON.parse(jsonText);
  return replaceState(parsedState);
}

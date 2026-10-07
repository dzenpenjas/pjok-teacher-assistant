export const GEMINI_API_KEY_STORAGE_KEY = "pjok_gemini_api_key";

function getLocalStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch (_) {}
  return null;
}

function getSessionStorage() {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage;
    }
    if (typeof globalThis !== "undefined" && globalThis.sessionStorage) {
      return globalThis.sessionStorage;
    }
  } catch (_) {}
  return null;
}

/**
 * Retrieves the stored Gemini API key.
 * 1. Checks localStorage for a valid, non-empty key.
 * 2. If absent, checks legacy sessionStorage.
 * 3. If found in sessionStorage, migrates it to localStorage and clears legacy copy.
 * 4. Returns trimmed key, or empty string if not found or on storage failure.
 *
 * @returns {string} The persistent Gemini API key or empty string.
 */
export function getGeminiApiKey() {
  try {
    const localStore = getLocalStorage();
    if (localStore) {
      const localVal = localStore.getItem(GEMINI_API_KEY_STORAGE_KEY);
      if (typeof localVal === "string" && localVal.trim()) {
        return localVal.trim();
      }
    }

    // Backward compatibility: migrate legacy sessionStorage key if present
    const sessionStore = getSessionStorage();
    if (sessionStore) {
      const sessionVal = sessionStore.getItem(GEMINI_API_KEY_STORAGE_KEY);
      if (typeof sessionVal === "string" && sessionVal.trim()) {
        const trimmed = sessionVal.trim();
        if (localStore) {
          try {
            localStore.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmed);
          } catch (_) {}
        }
        try {
          sessionStore.removeItem(GEMINI_API_KEY_STORAGE_KEY);
        } catch (_) {}
        return trimmed;
      }
    }
  } catch (_) {}

  return "";
}

/**
 * Persists the Gemini API key to localStorage.
 * Trims input and rejects empty values.
 *
 * @param {string} value The Gemini API key to persist.
 * @returns {boolean} True if saved, false if rejected or failed.
 */
export function setGeminiApiKey(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  try {
    const localStore = getLocalStorage();
    if (localStore) {
      localStore.setItem(GEMINI_API_KEY_STORAGE_KEY, trimmed);

      // Clean up legacy session copy if present
      const sessionStore = getSessionStorage();
      if (sessionStore) {
        try {
          sessionStore.removeItem(GEMINI_API_KEY_STORAGE_KEY);
        } catch (_) {}
      }
      return true;
    }
  } catch (_) {}

  return false;
}

/**
 * Completely removes the Gemini API key from persistent localStorage
 * and legacy sessionStorage.
 *
 * @returns {boolean} True on execution without unhandled error.
 */
export function removeGeminiApiKey() {
  try {
    const localStore = getLocalStorage();
    if (localStore) {
      try {
        localStore.removeItem(GEMINI_API_KEY_STORAGE_KEY);
      } catch (_) {}
    }

    const sessionStore = getSessionStorage();
    if (sessionStore) {
      try {
        sessionStore.removeItem(GEMINI_API_KEY_STORAGE_KEY);
      } catch (_) {}
    }
    return true;
  } catch (_) {}

  return false;
}

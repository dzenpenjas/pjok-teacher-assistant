import { APP_SCHEMA_VERSION, COLLECTIONS } from "../data/schema.js";
import { loadState, replaceState } from "./storage.js";

// --- 1. TIMESTAMPED BACKUP FILENAME GENERATOR ---
let lastExportTimestamp = "";
let lastExportCollisionCounter = 0;

/**
 * Generates unique backup filename: GuruPJOK_Backup_YYYY-MM-DD_HH-mm-ss_WIB.json
 * Uses actual Asia/Jakarta timezone.
 * Appends counter suffix if multiple backups are generated within the exact same second.
 */
export function generateBackupFilename(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);

  const p = {};
  for (const part of parts) {
    p[part.type] = part.value;
  }

  let hour = p.hour === "24" ? "00" : p.hour;
  const baseTime = `${p.year}-${p.month}-${p.day}_${hour}-${p.minute}-${p.second}_WIB`;

  if (baseTime === lastExportTimestamp) {
    lastExportCollisionCounter += 1;
    return `GuruPJOK_Backup_${baseTime}_${lastExportCollisionCounter}.json`;
  }

  lastExportTimestamp = baseTime;
  lastExportCollisionCounter = 0;
  return `GuruPJOK_Backup_${baseTime}.json`;
}

export function _resetBackupFilenameCounterForTesting() {
  lastExportTimestamp = "";
  lastExportCollisionCounter = 0;
}

// --- 2. BACKUP EXPORT (Pure generation, does NOT mark remote destination backup as done) ---
export function exportStateAsJson() {
  const state = loadState();
  return JSON.stringify(state, null, 2);
}

// --- 3. BACKUP INSPECTION & VERSION-SPECIFIC VALIDATION ---

// Required collections for current schema version (v8)
export const REQUIRED_COLLECTIONS_V8 = [
  "schools",
  "academicYears",
  "semesters",
  "teachers",
  "classes",
  "students",
  "studentNotes",
  "studentTags",
  "sessions",
  "schedules",
  "attendanceRecords",
  "sessionActivities",
  "assessmentDefinitions",
  "assessmentSessions",
  "assessmentResults",
  "growthRecords",
  "studentObservations",
  "studentReports"
];

export function inspectBackupJson(jsonText) {
  if (!jsonText || typeof jsonText !== "string" || !jsonText.trim()) {
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

  // Schema version compatibility check
  let versionNum = 1;
  if (parsedState.schemaVersion !== undefined && parsedState.schemaVersion !== null) {
    versionNum = Number(parsedState.schemaVersion);
    if (!Number.isFinite(versionNum) || versionNum < 1) {
      return { valid: false, error: "Versi skema cadangan (schemaVersion) tidak valid." };
    }
    if (versionNum > APP_SCHEMA_VERSION) {
      return {
        valid: false,
        error: `Versi skema cadangan (v${versionNum}) lebih baru dari versi yang didukung aplikasi (v${APP_SCHEMA_VERSION}). Harap perbarui aplikasi terlebih dahulu.`
      };
    }
  }

  // Strict structural completeness check for current schema version backups
  const isCurrentVersion = versionNum === APP_SCHEMA_VERSION;
  if (isCurrentVersion) {
    const missingCollections = REQUIRED_COLLECTIONS_V8.filter((col) => !(col in parsedState));
    if (missingCollections.length > 0) {
      return {
        valid: false,
        error: `Data cadangan versi ${APP_SCHEMA_VERSION} tidak lengkap secara struktural: koleksi wajib berikut tidak ditemukan: ${missingCollections.join(", ")}.`
      };
    }
  } else {
    // For legacy backups (version < APP_SCHEMA_VERSION): verify at least recognizable core PJOK keys exist
    const recognizableKeys = [
      "classes",
      "students",
      "schools",
      "teachers",
      "sessions",
      "schemaVersion",
      "academicYears",
      "assessmentDefinitions",
      "growthRecords",
      "studentReports"
    ];
    const hasRecognizableKey = recognizableKeys.some((k) => k in parsedState);
    if (!hasRecognizableKey) {
      return { valid: false, error: "File JSON tidak dikenali sebagai data cadangan PJOK Teacher Assistant." };
    }
  }

  // Structural & type validation of collection arrays
  const arrayCollections = [
    "classes",
    "students",
    "academicYears",
    "semesters",
    "studentNotes",
    "studentTags",
    "sessions",
    "schedules",
    "attendanceRecords",
    "sessionActivities",
    "assessmentDefinitions",
    "assessmentSessions",
    "assessmentResults",
    "growthRecords",
    "studentObservations",
    "studentReports"
  ];

  for (const col of arrayCollections) {
    if (col in parsedState) {
      if (!Array.isArray(parsedState[col])) {
        return {
          valid: false,
          error: `Struktur data tidak valid: properti ${col} harus berupa array.`
        };
      }
      for (let i = 0; i < parsedState[col].length; i++) {
        const item = parsedState[col][i];
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return {
            valid: false,
            error: `Struktur data rusak: item pada indeks ${i} di koleksi ${col} bukan objek valid.`
          };
        }
      }
    }
  }

  // Check singleton collections for legacy format (can be array or plain object)
  if ("schools" in parsedState) {
    const isArr = Array.isArray(parsedState.schools);
    const isObj = parsedState.schools && typeof parsedState.schools === "object" && !isArr;
    if (!isArr && !isObj) {
      return { valid: false, error: "Struktur data properti schools tidak valid." };
    }
  }
  if ("teachers" in parsedState) {
    const isArr = Array.isArray(parsedState.teachers);
    const isObj = parsedState.teachers && typeof parsedState.teachers === "object" && !isArr;
    if (!isArr && !isObj) {
      return { valid: false, error: "Struktur data properti teachers tidak valid." };
    }
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
    studentObservations: getArrayCount("studentObservations"),
    studentReports: getArrayCount("studentReports")
  };

  // Check for orphan references (report warnings only, NEVER delete or alter data)
  const warnings = [];
  const studentsList = Array.isArray(parsedState.students) ? parsedState.students : [];
  const studentIdSet = new Set(studentsList.map((s) => s && s.id).filter(Boolean));

  const orphanChecks = [
    { key: "studentNotes", label: "Catatan Siswa (studentNotes)" },
    { key: "growthRecords", label: "Catatan Pertumbuhan (growthRecords)" },
    { key: "attendanceRecords", label: "Rekap Presensi (attendanceRecords)" },
    { key: "assessmentResults", label: "Hasil Asesmen (assessmentResults)" },
    { key: "studentObservations", label: "Observasi Siswa (studentObservations)" },
    { key: "studentReports", label: "Laporan Siswa (studentReports)" }
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

// --- 4. BACKUP IMPORT & RESTORE ---
export function importStateFromJson(jsonText) {
  const check = inspectBackupJson(jsonText);
  if (!check.valid) {
    return {
      success: false,
      state: null,
      error: new Error(check.error)
    };
  }

  // Restore state. Note: safety snapshot is preserved inside replaceState!
  return replaceState(check.data);
}

// --- 5. AUTO-BACKUP READINESS: PERSISTENT METADATA & SUBSTANTIAL CHANGE DETECTION ---

const BACKUP_METADATA_KEY = "pjokTeacherAssistant.backupMetadata";

export function getBackupMetadataKey() {
  return BACKUP_METADATA_KEY;
}

/**
 * Loads persistent backup metadata from localStorage.
 */
export function loadBackupMetadata() {
  try {
    const raw = typeof window !== "undefined" && window.localStorage
      ? window.localStorage.getItem(BACKUP_METADATA_KEY)
      : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          lastConfirmedBackup: parsed.lastConfirmedBackup || null,
          lastManualExport: parsed.lastManualExport || null,
          pendingBackup: parsed.pendingBackup || null
        };
      }
    }
  } catch (err) {
    console.warn("Gagal membaca metadata backup:", err);
  }
  return {
    lastConfirmedBackup: null,
    lastManualExport: null,
    pendingBackup: null
  };
}

/**
 * Saves persistent backup metadata to localStorage.
 */
export function saveBackupMetadata(metadata) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
    }
    return true;
  } catch (err) {
    console.error("Gagal menyimpan metadata backup:", err);
    return false;
  }
}

/**
 * Extracts only substantial entities, ignoring transient UI states,
 * navigation screens (currentScreen), timestamps (updatedAt), and temporary UI filters.
 */
export function extractSubstantialState(state) {
  if (!state || typeof state !== "object") return {};

  const substantial = {};
  const collectionNames = Object.values(COLLECTIONS).sort();

  for (const col of collectionNames) {
    substantial[col] = Array.isArray(state[col]) ? state[col] : [];
  }

  // Include crucial scoping IDs
  substantial.activeAcademicYearId = state.activeAcademicYearId || null;
  substantial.activeSemesterId = state.activeSemesterId || null;

  return substantial;
}

/**
 * Computes a deterministic string signature for the substantial data.
 */
export function getSubstantialDataSignature(state) {
  const substantial = extractSubstantialState(state);
  return JSON.stringify(substantial);
}

/**
 * Compares two states and returns true only if substantial data has changed.
 * Ignores currentScreen, updatedAt, and transient UI fields.
 */
export function hasSubstantialDataChanged(prevState, nextState) {
  if (!prevState && !nextState) return false;
  if (!prevState || !nextState) return true;
  return getSubstantialDataSignature(prevState) !== getSubstantialDataSignature(nextState);
}

/**
 * Records manual JSON export event without falsely claiming remote destination backup success.
 */
export function recordManualExport({ filename, signature, state } = {}) {
  const meta = loadBackupMetadata();
  const sig = signature || (state ? getSubstantialDataSignature(state) : null);
  meta.lastManualExport = {
    filename: filename || null,
    signature: sig,
    timestamp: new Date().toISOString()
  };
  saveBackupMetadata(meta);
  return meta.lastManualExport;
}

/**
 * Registers an in-flight backup attempt to destination. Does NOT mark as confirmed success.
 */
export function recordBackupInProgress({ destination = "google_drive", signature, state } = {}) {
  const meta = loadBackupMetadata();
  const sig = signature || (state ? getSubstantialDataSignature(state) : null);
  meta.pendingBackup = {
    destination,
    signature: sig,
    startedAt: new Date().toISOString(),
    status: "in_progress"
  };
  saveBackupMetadata(meta);
  return meta.pendingBackup;
}

/**
 * Records confirmed successful backup to target destination.
 * ONLY call this when destination has explicitly confirmed the backup is stored.
 */
export function recordSuccessfulBackup({ destination = "google_drive", signature, state, metadata = {} } = {}) {
  const meta = loadBackupMetadata();
  const sig = signature || (state ? getSubstantialDataSignature(state) : null);
  if (!sig) {
    throw new Error("Signature data substansial diperlukan untuk mencatat backup berhasil.");
  }

  meta.lastConfirmedBackup = {
    destination,
    signature: sig,
    timestamp: new Date().toISOString(),
    status: "success",
    ...metadata
  };
  meta.pendingBackup = null; // Clear pending state
  saveBackupMetadata(meta);
  return meta.lastConfirmedBackup;
}

/**
 * Records a failed backup attempt to destination.
 */
export function recordBackupFailed({ destination = "google_drive", error } = {}) {
  const meta = loadBackupMetadata();
  meta.pendingBackup = {
    destination,
    failedAt: new Date().toISOString(),
    status: "failed",
    error: error?.message || String(error)
  };
  saveBackupMetadata(meta);
  return meta.pendingBackup;
}

/**
 * Checks whether the current state requires a backup compared to the last confirmed successful backup.
 * Returns true if no confirmed destination backup exists, or if substantial data has changed since.
 */
export function isBackupNeeded(state) {
  const meta = loadBackupMetadata();
  const currentSignature = getSubstantialDataSignature(state);
  if (!meta.lastConfirmedBackup || !meta.lastConfirmedBackup.signature) {
    return true;
  }
  return currentSignature !== meta.lastConfirmedBackup.signature;
}

/**
 * Retrieves the last confirmed destination backup info.
 */
export function getLastConfirmedBackup() {
  return loadBackupMetadata().lastConfirmedBackup;
}

/**
 * Retrieves the last manual export info.
 */
export function getLastManualExport() {
  return loadBackupMetadata().lastManualExport;
}

/**
 * Retrieves pending backup info.
 */
export function getPendingBackup() {
  return loadBackupMetadata().pendingBackup;
}

/**
 * Testing reset helper.
 */
export function _resetBackupMetadataForTesting() {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(BACKUP_METADATA_KEY);
    } catch (_) {}
  }
}

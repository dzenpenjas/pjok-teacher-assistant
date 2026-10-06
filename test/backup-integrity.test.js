import test from "node:test";
import assert from "node:assert/strict";

// Setup memory storage mock for test environment
const memoryStorage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
    setItem: (key, val) => memoryStorage.set(key, String(val)),
    removeItem: (key) => memoryStorage.delete(key),
    clear: () => memoryStorage.clear()
  },
  alert: () => {}
};
globalThis.localStorage = globalThis.window.localStorage;

import {
  replaceState,
  loadState,
  saveState,
  getStorageKey,
  verifyPersistedIntegrity
} from "../src/storage/storage.js";
import {
  exportStateAsJson,
  inspectBackupJson,
  importStateFromJson
} from "../src/storage/backup.js";

test("Full Backup Round-Trip preserves complete state, all collections, IDs, photos, and relationships", () => {
  memoryStorage.clear();

  const fullFixture = {
    schemaVersion: 7,
    currentScreen: "classes",
    schools: [
      { id: "sch-1", name: "SDN 1 Nusantara", address: "Jl. Pendidikan No. 1", phone: "0812345678" }
    ],
    teachers: [
      { id: "t-1", name: "Budi Santoso, S.Pd", employeeNumber: "198501012010011001", phone: "0812987654" }
    ],
    academicYears: [
      { id: "ay-1", name: "2025/2026", startsAt: "2025-07-01", endsAt: "2026-06-30", isActive: true }
    ],
    semesters: [
      { id: "sem-1", name: "Ganjil", academicYearId: "ay-1", isActive: true }
    ],
    classes: [
      { id: "cls-1", name: "Kelas 4A", grade: "4", academicYearId: "ay-1", teacherId: "t-1", status: "active" },
      { id: "cls-2", name: "Kelas 5B", grade: "5", academicYearId: "ay-1", teacherId: "t-1", status: "active" }
    ],
    students: [
      {
        id: "std-1",
        name: "Ahmad Fauzan",
        studentNumber: "00101",
        gender: "male",
        birthDate: "2015-03-12",
        classId: "cls-1",
        photo: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...", // Preserve photo
        tagIds: ["tag-1"],
        noteIds: ["note-1"]
      },
      {
        id: "std-2",
        name: "Siti Aisyah",
        studentNumber: "00102",
        gender: "female",
        birthDate: "2015-08-25",
        classId: "cls-1",
        photo: "data:image/jpeg;base64,/9j/4AAQSkZJRgSiti...",
        tagIds: [],
        noteIds: []
      },
      {
        id: "std-3",
        name: "Muhammad Fikri",
        studentNumber: "00201",
        gender: "male",
        birthDate: "2014-11-05",
        classId: "cls-2",
        photo: "",
        tagIds: ["tag-1"],
        noteIds: ["note-2"]
      }
    ],
    studentTags: [
      { id: "tag-1", name: "Asma", color: "#e11d48", category: "health", severity: "warning" }
    ],
    studentNotes: [
      { id: "note-1", studentId: "std-1", text: "Perlu istirahat setelah lari 400m" },
      { id: "note-2", studentId: "std-3", text: "Sangat berbakat dalam sepak bola" }
    ],
    sessions: [
      {
        id: "sess-1",
        sessionNumber: 1,
        classId: "cls-1",
        teacherId: "t-1",
        academicYearId: "ay-1",
        semesterId: "sem-1",
        date: "2025-08-01",
        startTime: "07:30",
        endTime: "09:00",
        topic: "Dribble Bola Tangan",
        material: "Gerak Manipulatif",
        location: "Lapangan Utama",
        weather: "Cerah",
        status: "completed"
      }
    ],
    schedules: [
      { id: "schd-1", dayOfWeek: 1, startTime: "07:30", endTime: "09:00", classId: "cls-1", location: "Lapangan Utama", active: true }
    ],
    attendanceRecords: [
      { id: "att-1", sessionId: "sess-1", studentId: "std-1", status: "present", recordedAt: "2025-08-01T07:35:00.000Z" },
      { id: "att-2", sessionId: "sess-1", studentId: "std-2", status: "present", recordedAt: "2025-08-01T07:35:00.000Z" }
    ],
    sessionActivities: [
      { id: "act-1", sessionId: "sess-1", name: "Pemanasan Statis Dinamis", type: "pemanasan", durationMinutes: 10, status: "completed" }
    ],
    assessmentDefinitions: [
      {
        id: "def-1",
        name: "Tes Dribble Bola Tangan",
        purpose: "formative",
        category: "keterampilan",
        assessmentType: "practice",
        method: "rubric",
        rubricScale: 5,
        materials: ["Bola Tangan"],
        items: [
          {
            id: "def-1-item-1",
            prompt: "Kontrol pantulan bola setinggi pinggang",
            rubricScale: 5,
            rubricLevels: [
              { level: 1, label: "Perlu Bimbingan", desc: "Bola sering lepas" },
              { level: 5, label: "Sangat Mahir", desc: "Kontrol sempurna dan konsisten" }
            ]
          }
        ]
      }
    ],
    assessmentSessions: [
      {
        id: "as-1",
        definitionId: "def-1",
        classId: "cls-1",
        teacherId: "t-1",
        date: "2025-08-01",
        name: "Penilaian Formatif Dribble",
        rubricScale: 5,
        itemsSnapshot: [
          {
            id: "def-1-item-1",
            prompt: "Kontrol pantulan bola setinggi pinggang",
            rubricScale: 5,
            rubricLevels: [
              { level: 1, label: "Perlu Bimbingan", desc: "Bola sering lepas" },
              { level: 5, label: "Sangat Mahir", desc: "Kontrol sempurna dan konsisten" }
            ]
          }
        ]
      }
    ],
    assessmentResults: [
      {
        id: "res-1",
        assessmentSessionId: "as-1",
        studentId: "std-1",
        definitionId: "def-1",
        score: 5,
        averageRubricScore: 5,
        completed: true,
        recordedAt: "2025-08-01T08:15:00.000Z",
        itemResults: [{ itemId: "def-1-item-1", score: 5 }]
      }
    ],
    growthRecords: [
      { id: "gw-1", studentId: "std-1", date: "2025-08-01", heightCm: "135", weightKg: "30", bmi: 16.5, bmiCategory: "-", note: "Awal semester" }
    ],
    studentObservations: [
      { id: "obs-1", studentId: "std-1", date: "2025-08-01", note: "Antusias dalam permainan kelompok", category: "attitude" }
    ]
  };

  // 1. Initial replaceState
  const initialReplace = replaceState(fullFixture);
  assert.equal(initialReplace.success, true);
  assert.equal(initialReplace.error, null);

  // 2. Export full state as JSON
  const exportedJson = exportStateAsJson();
  assert.equal(typeof exportedJson, "string");

  // 3. Inspect backup JSON
  const inspectRes = inspectBackupJson(exportedJson);
  assert.equal(inspectRes.valid, true);
  assert.equal(inspectRes.summary.classes, 2);
  assert.equal(inspectRes.summary.students, 3);
  assert.equal(inspectRes.summary.studentNotes, 2);
  assert.equal(inspectRes.summary.studentTags, 1);
  assert.equal(inspectRes.summary.growthRecords, 1);
  assert.equal(inspectRes.summary.assessmentResults, 1);
  assert.equal(inspectRes.summary.studentObservations, 1);
  assert.equal(inspectRes.summary.sessions, 1);
  assert.equal(inspectRes.summary.attendanceRecords, 2);
  assert.equal(inspectRes.summary.sessionActivities, 1);
  assert.equal(inspectRes.summary.assessmentDefinitions, 1);
  assert.equal(inspectRes.summary.assessmentSessions, 1);
  assert.equal(inspectRes.summary.academicYears, 1);
  assert.equal(inspectRes.summary.semesters, 1);
  assert.equal(inspectRes.summary.schools, 1);
  assert.equal(inspectRes.summary.teachers, 1);
  assert.equal(inspectRes.summary.schedules, 1);
  assert.deepEqual(inspectRes.warnings, []);

  // 4. Import full state from JSON
  const importRes = importStateFromJson(exportedJson);
  assert.equal(importRes.success, true);
  assert.equal(importRes.error, null);

  // 5. Verify restored state equivalence
  const restored = loadState();
  assert.equal(restored.classes.length, 2);
  assert.equal(restored.students.length, 3);
  assert.equal(restored.studentNotes.length, 2);
  assert.equal(restored.growthRecords.length, 1);
  assert.equal(restored.assessmentResults.length, 1);
  assert.equal(restored.attendanceRecords.length, 2);

  // Verify Student with photo, tags, notes
  const std1 = restored.students.find((s) => s.id === "std-1");
  assert.ok(std1);
  assert.equal(std1.name, "Ahmad Fauzan");
  assert.equal(std1.studentNumber, "00101");
  assert.equal(std1.gender, "male");
  assert.equal(std1.birthDate, "2015-03-12");
  assert.equal(std1.photo, "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...");
  assert.deepEqual(std1.tagIds, ["tag-1"]);
  assert.deepEqual(std1.noteIds, ["note-1"]);

  // Verify Assessment Result relationships
  const res1 = restored.assessmentResults.find((r) => r.id === "res-1");
  assert.ok(res1);
  assert.equal(res1.studentId, "std-1");
  assert.equal(res1.assessmentSessionId, "as-1");
  assert.equal(res1.definitionId, "def-1");
});

test("replaceState returns success: false and rolls back when localStorage throws QuotaExceededError", () => {
  memoryStorage.clear();

  // Set initial state
  const previousState = {
    schemaVersion: 7,
    students: [{ id: "std-initial", name: "Siswa Awal" }],
    classes: [{ id: "cls-initial", name: "Kelas Awal" }]
  };
  replaceState(previousState);
  const initialRaw = memoryStorage.get(getStorageKey());
  assert.ok(initialRaw);

  // Mock localStorage.setItem to throw QuotaExceededError
  const originalSetItem = globalThis.window.localStorage.setItem;
  const quotaError = new Error("Quota exceeded");
  quotaError.name = "QuotaExceededError";

  let attemptCount = 0;
  globalThis.window.localStorage.setItem = (key, val) => {
    attemptCount++;
    if (attemptCount === 1) {
      throw quotaError;
    }
    // Allow rollback write
    originalSetItem(key, val);
  };

  const candidateState = {
    schemaVersion: 7,
    students: [{ id: "std-new", name: "Siswa Baru" }]
  };

  const result = replaceState(candidateState);
  assert.equal(result.success, false);
  assert.equal(result.state, null);
  assert.equal(result.error, quotaError);

  // Restore original setItem
  globalThis.window.localStorage.setItem = originalSetItem;

  // Verify rollback restored previous raw state
  const rawAfter = memoryStorage.get(getStorageKey());
  assert.equal(rawAfter, initialRaw);
});

test("replaceState fails and rolls back when read-back verification detects data mismatch", () => {
  memoryStorage.clear();

  const previousState = {
    schemaVersion: 7,
    students: [{ id: "std-prev", name: "Siswa Sebelumnya" }]
  };
  replaceState(previousState);
  const initialRaw = memoryStorage.get(getStorageKey());

  // Mock localStorage.getItem to return corrupted state upon read-back
  const originalGetItem = globalThis.window.localStorage.getItem;
  let getCallCount = 0;
  globalThis.window.localStorage.getItem = (key) => {
    getCallCount++;
    if (getCallCount === 2) {
      // Return missing student in read-back
      return JSON.stringify({
        schemaVersion: 7,
        students: []
      });
    }
    return originalGetItem(key);
  };

  const candidateState = {
    schemaVersion: 7,
    students: [{ id: "std-target", name: "Siswa Target" }]
  };

  const result = replaceState(candidateState);
  assert.equal(result.success, false);
  assert.equal(result.state, null);
  assert.ok(result.error);

  globalThis.window.localStorage.getItem = originalGetItem;

  // Verify rollback was executed
  const currentRaw = memoryStorage.get(getStorageKey());
  assert.equal(currentRaw, initialRaw);
});

test("inspectBackupJson detects orphan references and reports clear integrity warnings without deleting records", () => {
  const backupWithOrphans = JSON.stringify({
    schemaVersion: 7,
    students: [{ id: "std-1", name: "Budi" }],
    studentNotes: [
      { id: "note-1", studentId: "std-1", text: "Valid note" },
      { id: "note-2", studentId: "std-missing-99", text: "Orphan note" }
    ],
    growthRecords: [
      { id: "gw-1", studentId: "std-missing-100", heightCm: "140", weightKg: "35" }
    ],
    attendanceRecords: [
      { id: "att-1", studentId: "std-missing-101", status: "present" }
    ],
    assessmentResults: [
      { id: "res-1", studentId: "std-missing-102", score: 4 }
    ],
    studentObservations: [
      { id: "obs-1", studentId: "std-missing-103", note: "Orphan obs" }
    ]
  });

  const check = inspectBackupJson(backupWithOrphans);
  assert.equal(check.valid, true);
  assert.equal(check.summary.students, 1);
  assert.equal(check.summary.studentNotes, 2);
  assert.equal(check.summary.growthRecords, 1);

  // Verify warnings generated for all orphan categories
  assert.equal(check.warnings.length, 5);
  assert.ok(check.warnings[0].includes("Catatan Siswa"));
  assert.ok(check.warnings[1].includes("Catatan Pertumbuhan"));
  assert.ok(check.warnings[2].includes("Rekap Presensi"));
  assert.ok(check.warnings[3].includes("Hasil Asesmen"));
  assert.ok(check.warnings[4].includes("Observasi Siswa"));

  // Ensure orphan records are still preserved in parsed data
  assert.equal(check.data.studentNotes.length, 2);
  assert.equal(check.data.growthRecords.length, 1);
});

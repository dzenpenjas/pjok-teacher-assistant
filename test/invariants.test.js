import test from "node:test";
import assert from "node:assert/strict";

// Setup mock window & localStorage for Node test runner
const memoryStorage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => memoryStorage.get(key) || null,
    setItem: (key, val) => memoryStorage.set(key, String(val)),
    removeItem: (key) => memoryStorage.delete(key),
    clear: () => memoryStorage.clear()
  }
};
globalThis.localStorage = globalThis.window.localStorage;

import { normalizeState } from "../src/storage/storage.js";
import { createInitialState } from "../src/data/schema.js";
import { inspectBackupJson } from "../src/storage/backup.js";
import { SchoolRepository } from "../src/repositories/school-repository.js";
import { TeacherRepository } from "../src/repositories/teacher-repository.js";
import { StudentRepository } from "../src/repositories/student-repository.js";
import { ClassRepository } from "../src/repositories/class-repository.js";
import { SessionManager } from "../src/services/session-manager.js";
import { createRepositoryContext } from "../src/repositories/repository-context.js";

test("Singleton School Invariant in State Normalization", () => {
  const state = createInitialState();
  state.schools = [
    { id: "sch-1", name: "SDN 1 Menteng" },
    { id: "sch-2", name: "SDN 2 Menteng" }
  ];
  const normalized = normalizeState(state);
  assert.equal(normalized.schools.length, 1);
  assert.equal(normalized.schools[0].id, "sch-1");
});

test("Singleton Teacher Invariant in State Normalization", () => {
  const state = createInitialState();
  state.teachers = [
    { id: "t-1", name: "Budi Santoso" },
    { id: "t-2", name: "Agus Prabowo" }
  ];
  const normalized = normalizeState(state);
  assert.equal(normalized.teachers.length, 1);
  assert.equal(normalized.teachers[0].id, "t-1");
});

test("Single Active Session Invariant in State Normalization", () => {
  const state = createInitialState();
  state.sessions = [
    { id: "sess-1", status: "active", topic: "Lari" },
    { id: "sess-2", status: "active", topic: "Bola" }
  ];
  const normalized = normalizeState(state);
  const activeSessions = normalized.sessions.filter((s) => s.status === "active");
  assert.equal(activeSessions.length, 1);
  assert.equal(activeSessions[0].id, "sess-2");
  const paused = normalized.sessions.find((s) => s.id === "sess-1");
  assert.equal(paused.status, "paused");
});

test("SessionManager starting new session auto-pauses active session", () => {
  const repos = createRepositoryContext();
  const sessionMgr = new SessionManager(repos.sessions);

  const sessA = sessionMgr.createSession({ topic: "Sesi A" }, { startImmediately: true });
  assert.equal(repos.sessions.findById(sessA.id).status, "active");

  const sessB = sessionMgr.createSession({ topic: "Sesi B" }, { startImmediately: true, autoPauseOther: true });
  assert.equal(repos.sessions.findById(sessB.id).status, "active");
  assert.equal(repos.sessions.findById(sessA.id).status, "paused");
});

test("Student Cascade Delete removes records across collections", () => {
  const repos = createRepositoryContext();
  const student = repos.students.create({ name: "Rian Pratama", classId: "c-1" }).at(-1);
  repos.attendanceRecords.create({ studentId: student.id, sessionId: "s-1", status: "H" });
  repos.assessmentResults.create({ studentId: student.id, sessionId: "s-1", score: 85 });
  repos.growthRecords.create({ studentId: student.id, heightCm: 140 });

  repos.students.deleteCascade(student.id);

  assert.equal(repos.students.findById(student.id), null);
  assert.equal(repos.attendanceRecords.list().filter((r) => r.studentId === student.id).length, 0);
  assert.equal(repos.assessmentResults.list().filter((r) => r.studentId === student.id).length, 0);
  assert.equal(repos.growthRecords.list().filter((r) => r.studentId === student.id).length, 0);
});

test("Class Cascade Delete removes students and sessions", () => {
  const repos = createRepositoryContext();
  const classItem = repos.classes.create({ name: "Kelas 6B" }).at(-1);
  const student = repos.students.create({ name: "Siti", classId: classItem.id }).at(-1);
  const session = repos.sessions.create({ classId: classItem.id, topic: "Senam" }).at(-1);

  repos.classes.deleteCascade(classItem.id);

  assert.equal(repos.classes.findById(classItem.id), null);
  assert.equal(repos.students.findById(student.id), null);
  assert.equal(repos.sessions.findById(session.id), null);
});

test("Backup inspection verifies structure and counts", () => {
  const validJson = JSON.stringify({
    schemaVersion: 1,
    schools: [{ id: "sch-1", name: "SDN 1" }],
    teachers: [{ id: "t-1", name: "Guru 1" }],
    classes: [{ id: "c-1", name: "5A" }],
    students: [{ id: "s-1", name: "Budi" }],
    sessions: [{ id: "sess-1" }],
    assessmentResults: []
  });

  const check = inspectBackupJson(validJson);
  assert.equal(check.valid, true);
  assert.equal(check.summary.students, 1);
  assert.equal(check.summary.classes, 1);

  const invalidJson = JSON.stringify({ name: "Random File" });
  const badCheck = inspectBackupJson(invalidJson);
  assert.equal(badCheck.valid, false);
});

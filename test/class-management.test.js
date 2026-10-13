import test from "node:test";
import assert from "node:assert/strict";

const memoryStorage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => memoryStorage.get(key) || null,
    setItem: (key, val) => memoryStorage.set(key, String(val)),
    removeItem: (key) => memoryStorage.delete(key),
    clear: () => memoryStorage.clear()
  },
  confirm: () => true
};
globalThis.localStorage = globalThis.window.localStorage;

import { createClassRoom, createClass } from "../src/data/models.js";
import { createRepositoryContext } from "../src/repositories/repository-context.js";

test("C1: createClassRoom and createClass alias support grade (1-6), gradeLevel, homeroomTeacher, academicYear, status", () => {
  const c1 = createClassRoom({
    name: "Kelas 4A",
    grade: "4",
    homeroomTeacher: "Ibu Nur",
    academicYear: "2026/2027",
    status: "active"
  });

  assert.equal(c1.name, "Kelas 4A");
  assert.equal(c1.grade, "4");
  assert.equal(c1.gradeLevel, "4");
  assert.equal(c1.homeroomTeacher, "Ibu Nur");
  assert.equal(c1.academicYear, "2026/2027");
  assert.equal(c1.status, "active");
  assert.ok(c1.id.startsWith("class-"));

  // Backward compatibility with legacy gradeLevel input
  const c2 = createClass({
    name: "Kelas 2B",
    gradeLevel: "2",
    homeroomTeacher: "Pak Joko"
  });
  assert.equal(c2.grade, "2");
  assert.equal(c2.gradeLevel, "2");
  assert.equal(c2.homeroomTeacher, "Pak Joko");
  assert.equal(c2.status, "active");
});

test("C2: ClassRepository archiveClass and restoreClass toggle status and manage schedules", () => {
  const repos = createRepositoryContext();
  const classItem = repos.classes.create({
    name: "Kelas 5A",
    grade: "5",
    homeroomTeacher: "Pak Budi"
  }).at(-1);

  // Add schedule linked to class
  const state = repos.classes.loadState();
  state.schedules = [
    { id: "sch-1", classId: classItem.id, active: true, dayOfWeek: 1 },
    { id: "sch-2", classId: "other-class", active: true, dayOfWeek: 2 }
  ];
  repos.classes.saveState(state);

  // Archive class
  const archiveRes = repos.classes.archiveClass(classItem.id);
  assert.equal(archiveRes.success, true);
  assert.equal(archiveRes.data.status, "archived");

  const archivedClass = repos.classes.findById(classItem.id);
  assert.equal(archivedClass.status, "archived");
  assert.equal(archivedClass.id, classItem.id); // ID must not change

  // Verify schedule was deactivated
  const stateAfterArchive = repos.classes.loadState();
  const linkedSchedule = stateAfterArchive.schedules.find((s) => s.id === "sch-1");
  const otherSchedule = stateAfterArchive.schedules.find((s) => s.id === "sch-2");
  assert.equal(linkedSchedule.active, false);
  assert.equal(otherSchedule.active, true);

  // Test active/archived list filters
  const activeClasses = repos.classes.getActiveClasses();
  const archivedClasses = repos.classes.getArchivedClasses();
  assert.ok(!activeClasses.some((c) => c.id === classItem.id));
  assert.ok(archivedClasses.some((c) => c.id === classItem.id));

  // Restore class
  const restoreRes = repos.classes.restoreClass(classItem.id);
  assert.equal(restoreRes.success, true);
  assert.equal(restoreRes.data.status, "active");

  const restoredClass = repos.classes.findById(classItem.id);
  assert.equal(restoredClass.status, "active");

  // Schedules must NOT be automatically reactivated
  const stateAfterRestore = repos.classes.loadState();
  assert.equal(stateAfterRestore.schedules.find((s) => s.id === "sch-1").active, false);
});

test("C3: ClassRepository deleteCascade thoroughly cleans up class-exclusive data without orphan records", () => {
  const repos = createRepositoryContext();
  const classA = repos.classes.create({ name: "Kelas 3A", grade: "3" }).at(-1);
  const classB = repos.classes.create({ name: "Kelas 3B", grade: "3" }).at(-1);

  // Student in classA and classB
  const studentA = repos.students.create({ name: "Ahmad", classId: classA.id }).at(-1);
  const studentB = repos.students.create({ name: "Beni", classId: classB.id }).at(-1);

  // Sessions
  const sessionA = repos.sessions.create({ classId: classA.id, topic: "Lari" }).at(-1);
  const sessionB = repos.sessions.create({ classId: classB.id, topic: "Lompat" }).at(-1);

  // Populate related collections
  const rawState = repos.classes.loadState();
  rawState.assessmentSessions = [
    { id: "as-1", classId: classA.id, sessionId: sessionA.id, assessmentId: "def-1" },
    { id: "as-2", classId: classB.id, sessionId: sessionB.id, assessmentId: "def-1" }
  ];
  rawState.assessmentResults = [
    { id: "ar-1", studentId: studentA.id, sessionId: sessionA.id, assessmentSessionId: "as-1", score: 85 },
    { id: "ar-2", studentId: studentB.id, sessionId: sessionB.id, assessmentSessionId: "as-2", score: 90 }
  ];
  rawState.attendanceRecords = [
    { id: "att-1", studentId: studentA.id, sessionId: sessionA.id, status: "present" },
    { id: "att-2", studentId: studentB.id, sessionId: sessionB.id, status: "present" }
  ];
  rawState.growthRecords = [
    { id: "gr-1", studentId: studentA.id, heightCm: 130, weightKg: 28 },
    { id: "gr-2", studentId: studentB.id, heightCm: 135, weightKg: 30 }
  ];
  rawState.studentObservations = [
    { id: "obs-1", studentId: studentA.id, sessionId: sessionA.id, text: "Aktif" },
    { id: "obs-2", studentId: studentB.id, sessionId: sessionB.id, text: "Fokus" }
  ];
  rawState.studentNotes = [
    { id: "note-1", studentId: studentA.id, text: "Catatan A" },
    { id: "note-2", studentId: studentB.id, text: "Catatan B" }
  ];
  rawState.studentReports = [
    { id: "rep-1", studentId: studentA.id, classId: classA.id, summary: "Laporan A" },
    { id: "rep-2", studentId: studentB.id, classId: classB.id, summary: "Laporan B" }
  ];
  rawState.schedules = [
    { id: "sch-1", classId: classA.id, dayOfWeek: 1 },
    { id: "sch-2", classId: classB.id, dayOfWeek: 2 }
  ];
  rawState.sessionActivities = [
    { id: "act-1", sessionId: sessionA.id, name: "Pemanasan A" },
    { id: "act-2", sessionId: sessionB.id, name: "Pemanasan B" }
  ];
  rawState.assessmentDefinitions = [
    { id: "def-1", title: "Global Kebugaran" }
  ];
  repos.classes.saveState(rawState);

  // Execute deleteCascade on Class A
  const deleteResult = repos.classes.deleteCascade(classA.id);
  assert.equal(deleteResult.success, true);
  assert.equal(deleteResult.data.id, classA.id);

  const finalState = repos.classes.loadState();

  // Class A removed, Class B intact
  assert.equal(finalState.classes.find((c) => c.id === classA.id), undefined);
  assert.ok(finalState.classes.find((c) => c.id === classB.id));

  // Student A removed, Student B intact
  assert.equal(finalState.students.find((s) => s.id === studentA.id), undefined);
  assert.ok(finalState.students.find((s) => s.id === studentB.id));

  // Session A removed, Session B intact
  assert.equal(finalState.sessions.find((s) => s.id === sessionA.id), undefined);
  assert.ok(finalState.sessions.find((s) => s.id === sessionB.id));

  // Assessment sessions cleaned up
  assert.equal(finalState.assessmentSessions.find((as) => as.id === "as-1"), undefined);
  assert.ok(finalState.assessmentSessions.find((as) => as.id === "as-2"));

  // Assessment results cleaned up
  assert.equal(finalState.assessmentResults.find((ar) => ar.id === "ar-1"), undefined);
  assert.ok(finalState.assessmentResults.find((ar) => ar.id === "ar-2"));

  // Attendance, growth, notes, observations, reports, schedules, activities of Class A cleaned up
  assert.equal(finalState.attendanceRecords.find((r) => r.id === "att-1"), undefined);
  assert.ok(finalState.attendanceRecords.find((r) => r.id === "att-2"));

  assert.equal(finalState.growthRecords.find((r) => r.id === "gr-1"), undefined);
  assert.ok(finalState.growthRecords.find((r) => r.id === "gr-2"));

  assert.equal(finalState.studentObservations.find((r) => r.id === "obs-1"), undefined);
  assert.ok(finalState.studentObservations.find((r) => r.id === "obs-2"));

  assert.equal(finalState.studentNotes.find((r) => r.id === "note-1"), undefined);
  assert.ok(finalState.studentNotes.find((r) => r.id === "note-2"));

  assert.equal(finalState.studentReports.find((r) => r.id === "rep-1"), undefined);
  assert.ok(finalState.studentReports.find((r) => r.id === "rep-2"));

  assert.equal(finalState.schedules.find((r) => r.id === "sch-1"), undefined);
  assert.ok(finalState.schedules.find((r) => r.id === "sch-2"));

  assert.equal(finalState.sessionActivities.find((r) => r.id === "act-1"), undefined);
  assert.ok(finalState.sessionActivities.find((r) => r.id === "act-2"));

  // Global assessment definition must NOT be deleted
  assert.ok(finalState.assessmentDefinitions.find((def) => def.id === "def-1"));

  // Non-existent class returns failure contract
  const nonExistentRes = repos.classes.deleteCascade("non-existent-id");
  assert.equal(nonExistentRes.success, false);
});

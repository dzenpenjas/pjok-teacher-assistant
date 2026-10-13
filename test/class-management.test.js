import test from "node:test";
import assert from "node:assert/strict";

let shouldFailWrites = false;
let confirmChoice = true;

const memoryStorage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => memoryStorage.get(key) || null,
    setItem: (key, val) => {
      if (shouldFailWrites) {
        const err = new Error("QuotaExceededError: Local Storage kuota penuh");
        err.name = "QuotaExceededError";
        throw err;
      }
      memoryStorage.set(key, String(val));
    },
    removeItem: (key) => memoryStorage.delete(key),
    clear: () => memoryStorage.clear()
  },
  confirm: () => confirmChoice,
  alert: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.localStorage = globalThis.window.localStorage;
if (!globalThis.document) {
  globalThis.document = {
    querySelector: () => null,
    createElement: () => ({ append: () => {}, className: "", textContent: "" })
  };
}

import { createClassRoom, createClass } from "../src/data/models.js";
import { createRepositoryContext } from "../src/repositories/repository-context.js";
import { actions } from "../src/app.js";

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

test("R1: Tambah kelas berhasil dan gagal disimpan", () => {
  const repos = createRepositoryContext();
  shouldFailWrites = false;

  // Berhasil
  const createRes = actions.createClass({
    name: "Kelas 1A Baru",
    grade: "1",
    homeroomTeacher: "Pak Rahman",
    academicYear: "2026/2027"
  });
  assert.equal(createRes.success, true);
  assert.equal(createRes.error, null);
  assert.ok(createRes.data);
  const classId = createRes.data.id || (Array.isArray(createRes.data) ? createRes.data.at(-1).id : null);
  assert.ok(classId);
  const found = repos.classes.findById(classId);
  assert.ok(found);
  assert.equal(found.name, "Kelas 1A Baru");
  assert.equal(found.grade, "1");

  // Gagal disimpan (simulasi storage error)
  shouldFailWrites = true;
  const failRes = actions.createClass({
    name: "Kelas 1B Gagal",
    grade: "1"
  });
  assert.equal(failRes.success, false);
  assert.equal(failRes.data, null);
  assert.ok(failRes.error);

  // Pastikan data tidak tersimpan
  shouldFailWrites = false;
  const classesAfterFail = repos.classes.findAll();
  assert.ok(!classesAfterFail.some((c) => c.name === "Kelas 1B Gagal"));
});

test("R2: Edit kelas berhasil dan gagal disimpan", () => {
  const repos = createRepositoryContext();
  shouldFailWrites = false;

  const initial = actions.createClass({ name: "Kelas 2A Awal", grade: "2", homeroomTeacher: "Bu Susi" }).data;
  const classId = initial.id || (Array.isArray(initial) ? initial.at(-1).id : null);

  // Edit berhasil
  const updateRes = actions.updateClass(classId, {
    name: "Kelas 2A Unggulan",
    grade: "2",
    homeroomTeacher: "Bu Susi Updated",
    academicYear: "2026/2027"
  });
  assert.equal(updateRes.success, true);
  assert.equal(updateRes.error, null);
  const updatedInDb = repos.classes.findById(classId);
  assert.equal(updatedInDb.name, "Kelas 2A Unggulan");
  assert.equal(updatedInDb.homeroomTeacher, "Bu Susi Updated");
  assert.equal(updatedInDb.id, classId); // ID kelas tetap sama

  // Edit gagal disimpan
  shouldFailWrites = true;
  const failUpdateRes = actions.updateClass(classId, {
    name: "Kelas Rusak",
    grade: "2"
  });
  assert.equal(failUpdateRes.success, false);
  assert.equal(failUpdateRes.data, null);
  assert.ok(failUpdateRes.error);

  // Data tersimpan tidak berubah
  shouldFailWrites = false;
  const verifyDb = repos.classes.findById(classId);
  assert.equal(verifyDb.name, "Kelas 2A Unggulan");
});

test("R3: Arsip kelas berhasil dan gagal disimpan", () => {
  const repos = createRepositoryContext();
  shouldFailWrites = false;

  const created = actions.createClass({ name: "Kelas 3A Arsip", grade: "3" }).data;
  const classId = created.id || (Array.isArray(created) ? created.at(-1).id : null);

  // Jadwal terkait
  const state = repos.classes.loadState();
  state.schedules = [{ id: "sch-3a-arsip", classId, active: true, dayOfWeek: 1 }];
  repos.classes.saveState(state);

  // Arsip berhasil
  const archiveRes = actions.archiveClass(classId);
  assert.equal(archiveRes.success, true);
  assert.equal(archiveRes.error, null);
  assert.equal(archiveRes.data.status, "archived");
  assert.equal(archiveRes.data.id, classId);

  // Jadwal dinonaktifkan
  const stateAfter = repos.classes.loadState();
  assert.equal(stateAfter.schedules.find((s) => s.id === "sch-3a-arsip").active, false);

  // Arsip gagal disimpan
  const another = actions.createClass({ name: "Kelas 3B Arsip", grade: "3" }).data;
  const anotherId = another.id || (Array.isArray(another) ? another.at(-1).id : null);

  shouldFailWrites = true;
  const failArchive = actions.archiveClass(anotherId);
  assert.equal(failArchive.success, false);
  assert.equal(failArchive.data, null);
  assert.ok(failArchive.error);

  shouldFailWrites = false;
  const anotherInDb = repos.classes.findById(anotherId);
  assert.equal(anotherInDb.status, "active");
});

test("R4: Pulihkan kelas berhasil dan gagal disimpan", () => {
  const repos = createRepositoryContext();
  shouldFailWrites = false;

  const created = actions.createClass({ name: "Kelas 4A Pulih", grade: "4" }).data;
  const classId = created.id || (Array.isArray(created) ? created.at(-1).id : null);
  actions.archiveClass(classId);
  assert.equal(repos.classes.findById(classId).status, "archived");

  // Pulihkan berhasil
  const restoreRes = actions.restoreClass(classId);
  assert.equal(restoreRes.success, true);
  assert.equal(restoreRes.error, null);
  assert.equal(restoreRes.data.status, "active");
  assert.equal(repos.classes.findById(classId).status, "active");

  // Pulihkan gagal disimpan
  actions.archiveClass(classId);
  shouldFailWrites = true;
  const failRestore = actions.restoreClass(classId);
  assert.equal(failRestore.success, false);
  assert.equal(failRestore.data, null);
  assert.ok(failRestore.error);

  shouldFailWrites = false;
  assert.equal(repos.classes.findById(classId).status, "archived");
});

test("R5: Hapus kelas berhasil dan gagal disimpan", () => {
  const repos = createRepositoryContext();
  shouldFailWrites = false;
  confirmChoice = true;

  const created = actions.createClass({ name: "Kelas 5A Hapus", grade: "5" }).data;
  const classId = created.id || (Array.isArray(created) ? created.at(-1).id : null);
  const student = repos.students.create({ name: "Siswa 5A", classId }).at(-1);

  // Hapus berhasil
  const deleteRes = actions.deleteClass(classId);
  assert.equal(deleteRes.success, true);
  assert.equal(deleteRes.cancelled, false);
  assert.equal(deleteRes.error, null);
  assert.equal(repos.classes.findById(classId), null);
  assert.equal(repos.students.findById(student.id), null);

  // Hapus gagal disimpan
  const created2 = actions.createClass({ name: "Kelas 5B Hapus", grade: "5" }).data;
  const classId2 = created2.id || (Array.isArray(created2) ? created2.at(-1).id : null);
  const student2 = repos.students.create({ name: "Siswa 5B", classId: classId2 }).at(-1);

  shouldFailWrites = true;
  const failDelete = actions.deleteClass(classId2);
  assert.equal(failDelete.success, false);
  assert.equal(failDelete.cancelled, false);
  assert.equal(failDelete.data, null);
  assert.ok(failDelete.error);

  shouldFailWrites = false;
  assert.ok(repos.classes.findById(classId2));
  assert.ok(repos.students.findById(student2.id));
});

test("R6: Pembatalan hapus tidak mengubah data", () => {
  const repos = createRepositoryContext();
  shouldFailWrites = false;

  const created = actions.createClass({ name: "Kelas 6A Batal", grade: "6" }).data;
  const classId = created.id || (Array.isArray(created) ? created.at(-1).id : null);
  const student = repos.students.create({ name: "Siswa 6A", classId }).at(-1);

  // Pengguna membatalkan konfirmasi
  confirmChoice = false;
  const cancelRes = actions.deleteClass(classId);
  assert.equal(cancelRes.success, false);
  assert.equal(cancelRes.cancelled, true);
  assert.equal(cancelRes.data, null);
  assert.equal(cancelRes.error, null);

  // Data kelas dan siswa tetap utuh
  assert.ok(repos.classes.findById(classId));
  assert.ok(repos.students.findById(student.id));

  confirmChoice = true;
});

test("R7: Kegagalan operasi tidak menghasilkan status sukses palsu", () => {
  shouldFailWrites = false;

  // Nama kelas kosong
  const invalidName = actions.createClass({ name: "", grade: "3" });
  assert.equal(invalidName.success, false);
  assert.ok(invalidName.error);

  // Grade tidak valid
  const invalidGrade = actions.createClass({ name: "Kelas X", grade: "99" });
  assert.equal(invalidGrade.success, false);
  assert.ok(invalidGrade.error);

  // Update kelas non-existent
  const updateNonExist = actions.updateClass("non-existent-id", { name: "Test", grade: "1" });
  assert.equal(updateNonExist.success, false);
  assert.ok(updateNonExist.error);

  // Arsip non-existent
  const archiveNonExist = actions.archiveClass("non-existent-id");
  assert.equal(archiveNonExist.success, false);
  assert.ok(archiveNonExist.error);

  // Pulihkan non-existent
  const restoreNonExist = actions.restoreClass("non-existent-id");
  assert.equal(restoreNonExist.success, false);
  assert.ok(restoreNonExist.error);

  // Hapus non-existent
  const deleteNonExist = actions.deleteClass("non-existent-id");
  assert.equal(deleteNonExist.success, false);
  assert.ok(deleteNonExist.error);
});

test("R8: Data kelas lain tetap identik", () => {
  const repos = createRepositoryContext();
  shouldFailWrites = false;
  confirmChoice = true;

  const classA = actions.createClass({ name: "Kelas A Lain", grade: "3", homeroomTeacher: "Guru A" }).data;
  const classB = actions.createClass({ name: "Kelas B Lain", grade: "3", homeroomTeacher: "Guru B" }).data;
  const classAId = classA.id || (Array.isArray(classA) ? classA.at(-1).id : null);
  const classBId = classB.id || (Array.isArray(classB) ? classB.at(-1).id : null);

  const studentB = repos.students.create({ name: "Siswa B", classId: classBId }).at(-1);

  const initialClassB = JSON.stringify(repos.classes.findById(classBId));
  const initialStudentB = JSON.stringify(repos.students.findById(studentB.id));

  // Edit Class A
  actions.updateClass(classAId, { name: "Kelas A Edit", grade: "3" });
  assert.equal(JSON.stringify(repos.classes.findById(classBId)), initialClassB);
  assert.equal(JSON.stringify(repos.students.findById(studentB.id)), initialStudentB);

  // Archive Class A
  actions.archiveClass(classAId);
  assert.equal(JSON.stringify(repos.classes.findById(classBId)), initialClassB);

  // Restore Class A
  actions.restoreClass(classAId);
  assert.equal(JSON.stringify(repos.classes.findById(classBId)), initialClassB);

  // Delete Class A
  actions.deleteClass(classAId);
  assert.equal(JSON.stringify(repos.classes.findById(classBId)), initialClassB);
  assert.equal(JSON.stringify(repos.students.findById(studentB.id)), initialStudentB);
});

test("R9: Data existing tetap kompatibel", () => {
  // Legacy model input dengan gradeLevel tanpa grade
  const legacyClass = createClassRoom({
    id: "class-legacy-1",
    name: "Kelas 4 Lama",
    gradeLevel: "4",
    homeroomTeacher: "Pak Veteran",
    customField: "preserved-val",
    createdAt: "2025-01-01T00:00:00.000Z"
  });

  assert.equal(legacyClass.id, "class-legacy-1");
  assert.equal(legacyClass.grade, "4");
  assert.equal(legacyClass.gradeLevel, "4");
  assert.equal(legacyClass.homeroomTeacher, "Pak Veteran");
  assert.equal(legacyClass.customField, "preserved-val");
  assert.equal(legacyClass.status, "active");

  // Alias createClass
  const legacyClass2 = createClass({
    name: "Kelas 1 Lama",
    gradeLevel: "1"
  });
  assert.equal(legacyClass2.grade, "1");
  assert.equal(legacyClass2.gradeLevel, "1");
  assert.equal(legacyClass2.status, "active");
});
